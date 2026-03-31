import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  collection,
  getDocs,
  doc,
  getDoc,
  addDoc,
  setDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  limit,
  startAt
} from 'firebase/firestore';
import { auth, db, storage } from '../../firebaseConfig';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { getChatParticipants } from '../../utils/chatUtils';
import { showToast } from '../../utils/toast';
import Header from '../../components/Header';
import '../../styles/Chat.css';
import attachIcon from '../../assets/chatassets/attach.svg';
import sendIcon from '../../assets/chatassets/send.svg';

const _avatarCache = {};

const isMissionLocked = (date) => {
  if (!date) return false;
  const end = new Date(date);
  if (isNaN(end.getTime())) return false;
  return Date.now() > end.getTime() + 7 * 24 * 60 * 60 * 1000;
};

const getLastMessage = async (missionId) => {
  try {
    const q = query(
      collection(db, 'missions', missionId, 'chat'),
      orderBy('timestamp', 'desc'),
      limit(2)
    );
    const snap = await getDocs(q);
    const msgDoc = snap.docs.find(d => d.id !== '_meta');
    if (!msgDoc) return { text: '', at: null };
    const msg = msgDoc.data();
    return {
      text: msg.text || msg.fileName || 'Attachment',
      at:   msg.timestamp?.toDate?.() || null,
    };
  } catch { return { text: '', at: null }; }
};

export default function Chat() {
  const { missionId } = useParams();
  const navigate = useNavigate();

  const [missions, setMissions] = useState([]);
  const [filter, setFilter] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMission, setSelectedMission] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [avatarCache, setAvatarCache] = useState({});
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const fileInputRef = useRef(null);
  const MESSAGES_PER_PAGE = 20;
  const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]);
  const MAX_IMAGE_DIMENSION = 1280;
  const IMAGE_QUALITY = 0.7;

  // Fetch missions using userMissions reverse index (fast)
  useEffect(() => {
    const fetchMissions = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const buildMission = async (id, data) => {
          const last = await getLastMessage(id);
          return {
            id,
            title:         data.title || 'Untitled Mission',
            description:   data.description || '',
            date:          data.date || data.targetDate || '',
            role:          data.role || 'volunteer',
            lastMessage:   last.text,
            lastMessageAt: last.at,
          };
        };

        // Fast path
        const userMissionsSnap = await getDocs(
          collection(db, 'userMissions', user.uid, 'missions')
        );

        if (!userMissionsSnap.empty) {
          const arr = await Promise.all(
            userMissionsSnap.docs.map(d => buildMission(d.id, d.data()))
          );
          finalize(arr);
          return;
        }

        // Fallback + self-heal for existing users
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        const isAdmin = userSnap.exists() && userSnap.data().role === 'admin';
        const allSnap = await getDocs(collection(db, 'missions'));
        const found = [];

        await Promise.all(allSnap.docs.map(async (mDoc) => {
          const mId   = mDoc.id;
          const mData = mDoc.data();
          let role    = isAdmin ? 'admin' : null;

          if (!role) {
            const [vS, fS, pS] = await Promise.all([
              getDoc(doc(db, 'missions', mId, 'volunteer', user.uid)),
              getDoc(doc(db, 'missions', mId, 'faculty',   user.uid)),
              getDoc(doc(db, 'missions', mId, 'partner',   user.uid)),
            ]);
            if (vS.exists()) role = 'volunteer';
            else if (fS.exists()) role = 'faculty';
            else if (pS.exists()) role = 'partner';
          }

          if (role) {
            found.push({ id: mId, data: { ...mData, role, date: mData.targetDate || '' } });
            setDoc(doc(db, 'userMissions', user.uid, 'missions', mId), {
              missionId: mId, title: mData.title || 'Untitled Mission',
              role, date: mData.targetDate || '',
            }).catch(() => {});
          }
        }));

        const arr = await Promise.all(found.map(m => buildMission(m.id, m.data)));
        finalize(arr);
      } catch (err) {
        console.error('Error fetching missions:', err);
        setLoading(false);
      }
    };

    const finalize = (arr) => {
      arr.sort((a, b) => {
        if (!a.lastMessageAt && !b.lastMessageAt) return 0;
        if (!a.lastMessageAt) return 1;
        if (!b.lastMessageAt) return -1;
        return b.lastMessageAt - a.lastMessageAt;
      });
      setMissions(arr);
      if (missionId) {
        const found = arr.find(m => m.id === missionId);
        if (found) setSelectedMission(found);
      }
      setLoading(false);
    };

    fetchMissions();
  }, [missionId]);

  // Real-time messages with pagination
  useEffect(() => {
    if (!selectedMission) return;

    const fetchParticipants = async () => {
      try {
        const participantsData = await getChatParticipants(selectedMission.id);
        const allParticipants = [
          ...participantsData.volunteers,
          ...participantsData.faculty,
          ...participantsData.partners,
          ...participantsData.admins
        ];
      } catch (err) {
        console.error('Error fetching participants:', err);
      }
    };

    fetchParticipants();

    const q = query(
      collection(db, 'missions', selectedMission.id, 'chat'),
      orderBy('timestamp', 'desc'),
      limit(MESSAGES_PER_PAGE + 1)
    );

    const unsubscribe = onSnapshot(q, snapshot => {
      const messagesList = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(msg => msg.id !== '_meta');

      if (messagesList.length > MESSAGES_PER_PAGE) {
        setHasMoreMessages(true);
        messagesList.pop();
      } else {
        setHasMoreMessages(false);
      }

      setMessages(messagesList.reverse());
    });

    return () => unsubscribe();
  }, [selectedMission]);

  // Fetch avatars for any sender not yet in cache
  useEffect(() => {
    const missingIds = [...new Set(messages.map(m => m.senderId))]
      .filter(uid => uid && !(uid in avatarCache));
    if (missingIds.length === 0) return;
    missingIds.forEach(async (uid) => {
      try {
        const snap = await getDoc(doc(db, 'users', uid));
        const avatar = snap.exists() ? (snap.data().avatar || snap.data().photoURL || '') : '';
        setAvatarCache(prev => ({ ...prev, [uid]: avatar }));
      } catch { setAvatarCache(prev => ({ ...prev, [uid]: '' })); }
    });
  }, [messages]);

  const handleSendMessage = async () => {
    if (pendingAttachment) {
      const uploadFile = pendingAttachment.type.startsWith('image/')
        ? await compressImage(pendingAttachment)
        : pendingAttachment;
      await handleSendAttachment(uploadFile);
      return;
    }

    if (!messageInput.trim() || !selectedMission) return;

    try {
      const user = auth.currentUser;
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.exists() ? userDoc.data() : {};

      await addDoc(
        collection(db, 'missions', selectedMission.id, 'chat'),
        {
          senderId:   user.uid,
          senderName: userData.name || user.displayName || 'User',
          senderRole: selectedMission.role,
          text:       messageInput.trim(),
          timestamp:  serverTimestamp(),
          type:       'text'
        }
      );

      setMessageInput('');
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const handleAttachmentChange = e => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      showToast('Only JPEG, PNG, PDF, and Excel files are allowed.');
      e.target.value = '';
      return;
    }

    setPendingAttachment(file);
    e.target.value = '';
  };

  const handleRemoveAttachment = () => {
    setPendingAttachment(null);
  };

  const compressImage = async file => {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;

    if (width > height && width > MAX_IMAGE_DIMENSION) {
      height = Math.round((height * MAX_IMAGE_DIMENSION) / width);
      width = MAX_IMAGE_DIMENSION;
    } else if (height >= width && height > MAX_IMAGE_DIMENSION) {
      width = Math.round((width * MAX_IMAGE_DIMENSION) / height);
      height = MAX_IMAGE_DIMENSION;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise(resolve =>
      canvas.toBlob(
        resolve,
        file.type || 'image/jpeg',
        file.type === 'image/png' ? undefined : IMAGE_QUALITY
      )
    );

    return new File([blob], file.name, {
      type: blob.type || file.type,
      lastModified: file.lastModified
    });
  };

  const handleSendAttachment = async file => {
    if (!selectedMission || !file) return;

    try {
      setUploadingAttachment(true);

      const user = auth.currentUser;
      if (!user) throw new Error('No user logged in');

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.exists() ? userDoc.data() : {};

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `chat-attachments/${selectedMission.id}/${user.uid}_${Date.now()}_${safeName}`;
      const storageRef = ref(storage, storagePath);

      await uploadBytes(storageRef, file, { contentType: file.type });
      const downloadURL = await getDownloadURL(storageRef);

      await addDoc(collection(db, 'missions', selectedMission.id, 'chat'), {
        senderId:   user.uid,
        senderName: userData.name || user.displayName || 'User',
        senderRole: selectedMission.role,
        type:       'attachment',
        fileUrl:    downloadURL,
        fileName:   file.name,
        fileSize:   file.size,
        fileType:   file.type,
        timestamp:  serverTimestamp()
      });

      setPendingAttachment(null);
    } catch (err) {
      console.error('Error sending attachment:', err);
      showToast('Failed to upload attachment. Please try again.');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleLoadMore = async () => {
    if (!selectedMission || !hasMoreMessages || messages.length === 0) return;

    setLoadingMore(true);
    try {
      const oldestMessage = messages[0];
      const q = query(
        collection(db, 'missions', selectedMission.id, 'chat'),
        orderBy('timestamp', 'desc'),
        startAt(oldestMessage.timestamp),
        limit(MESSAGES_PER_PAGE + 1)
      );

      const snapshot = await getDocs(q);
      const newMessages = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(msg => msg.id !== '_meta' && msg.id !== oldestMessage.id);

      if (newMessages.length > MESSAGES_PER_PAGE) {
        setHasMoreMessages(true);
        newMessages.pop();
      } else {
        setHasMoreMessages(false);
      }

      setMessages([...newMessages.reverse(), ...messages]);
    } catch (err) {
      console.error('Error loading more messages:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSelectMission = mission => {
    setSelectedMission(mission);
    setMessages([]);
    setHasMoreMessages(true);
    navigate(`/chat/${mission.id}`);
  };

  const handleBack = () => {
    setSelectedMission(null);
    setMessages([]);
    setHasMoreMessages(true);
    navigate('/chat');
  };

  const isChatLocked = isMissionLocked(selectedMission?.date);

  const displayedMissions = missions
    .filter(m => filter === 'active' ? !isMissionLocked(m.date) : isMissionLocked(m.date))
    .filter(m => !searchQuery.trim() || m.title.toLowerCase().includes(searchQuery.toLowerCase()));

  const formatRelativeTime = (date) => {
    if (!date) return '';
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)   return 'now';
    if (mins < 60)  return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)   return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7)   return `${days}d`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="chat-page">
          <div className="chat-loading">Loading...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="chat-page">

        {/* ── LEFT: Conversation list ── */}
        <div className={`chat-list-panel${selectedMission ? ' chat-mobile-hidden' : ''}`}>
          <div className="chat-list-header">
            <button className="chat-list-back-btn" onClick={() => navigate(-1)} aria-label="Go back">‹</button>
            <h2>Messages</h2>
          </div>

          <div className="chat-list-search-wrap">
            <input
              type="text"
              placeholder="Search conversations…"
              className="chat-list-search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="chat-filter-tabs">
            <button className={`chat-filter-tab ${filter === 'active' ? 'active' : ''}`} onClick={() => setFilter('active')}>Active</button>
            <button className={`chat-filter-tab ${filter === 'closed' ? 'active' : ''}`} onClick={() => setFilter('closed')}>Closed</button>
          </div>

          <div className="chat-list-items">
            {displayedMissions.length === 0 ? (
              <div className="chat-list-empty">
                {filter === 'active' ? 'No active chats' : 'No closed chats'}
              </div>
            ) : (
              displayedMissions.map(mission => (
                <button
                  key={mission.id}
                  className={`chat-list-item${selectedMission?.id === mission.id ? ' chat-list-item--active' : ''}`}
                  onClick={() => handleSelectMission(mission)}
                >
                  <div className="chat-list-avatar">
                    {mission.title.charAt(0).toUpperCase()}
                  </div>
                  <div className="chat-list-content">
                    <div className="chat-list-row">
                      <span className="chat-list-title">{mission.title}</span>
                      <span className="chat-list-time">{formatRelativeTime(mission.lastMessageAt)}</span>
                    </div>
                    <p className="chat-list-preview">
                      {isMissionLocked(mission.date) ? '🔒 Closed' : (mission.lastMessage || 'No messages yet')}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── RIGHT: Chat conversation ── */}
        <div className={`chat-convo-panel${!selectedMission ? ' chat-mobile-hidden' : ''}`}>
          {!selectedMission ? (
            <div className="chat-no-convo">
              <p>Select a conversation to start messaging</p>
            </div>
          ) : (
            <>
              {/* Topbar: back button + mission title */}
              <div className="chat-convo-topbar">
                <button className="chat-back-btn" onClick={handleBack} aria-label="Back">‹</button>
                <span className="chat-convo-topbar-title">{selectedMission.title}</span>
                {isChatLocked && <span className="chat-convo-topbar-closed">Closed</span>}
              </div>

              {/* Messages */}
              <div className="chat-messages">
                {messages.length === 0 ? (
                  <div className="chat-empty"><p>No messages yet. Start the conversation!</p></div>
                ) : (
                  <>
                    {hasMoreMessages && (
                      <button onClick={handleLoadMore} disabled={loadingMore} className="chat-load-more-btn">
                        {loadingMore ? 'Loading...' : 'Load earlier messages'}
                      </button>
                    )}
                    {messages.map(message => (
                      <div key={message.id} className={`chat-message ${message.senderId === auth.currentUser?.uid ? 'sent' : 'received'}`}>
                        {message.senderId !== auth.currentUser?.uid && (
                          <div className="chat-message-avatar">
                            {avatarCache[message.senderId] ? (
                              <img src={avatarCache[message.senderId]} alt={message.senderName} className="chat-message-avatar-img" />
                            ) : (
                              message.senderName?.charAt(0).toUpperCase() || 'U'
                            )}
                          </div>
                        )}
                        <div className="chat-message-content">
                          {message.senderId !== auth.currentUser?.uid && (
                            <div className="chat-message-sender">{message.senderName}</div>
                          )}
                          <div className="chat-message-bubble">
                            {message.type === 'attachment' ? (
                              <div className="chat-message-text">
                                {message.fileType?.startsWith('image/') ? (
                                  <a href={message.fileUrl} target="_blank" rel="noreferrer">
                                    <img src={message.fileUrl} alt={message.fileName || 'Attachment'} style={{ maxWidth: 220, borderRadius: 8 }} />
                                  </a>
                                ) : (
                                  <a href={message.fileUrl} target="_blank" rel="noreferrer">{message.fileName || 'Attachment'}</a>
                                )}
                              </div>
                            ) : (
                              <div className="chat-message-text">{message.text}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>

              {/* Attachment preview */}
              {!isChatLocked && pendingAttachment && (
                <div className="chat-attachment-preview">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {pendingAttachment.type.startsWith('image/') ? (
                      <img src={URL.createObjectURL(pendingAttachment)} alt="preview" style={{ width: '40px', height: '40px', borderRadius: '4px', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '40px', height: '40px', backgroundColor: '#ddd', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>📄</div>
                    )}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>{pendingAttachment.name}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>{(pendingAttachment.size / 1024).toFixed(2)} KB</div>
                    </div>
                  </div>
                  <button type="button" onClick={handleRemoveAttachment} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>✕</button>
                </div>
              )}

              {/* Input or locked notice */}
              {isChatLocked ? (
                <div className="chat-locked-notice"><span>This chat is closed</span></div>
              ) : (
                <div className="chat-input-area">
                  <button type="button" className="chat-input-icon" onClick={handleAttachmentClick} disabled={uploadingAttachment}>
                    <img src={attachIcon} alt="Attach" width="20" height="20" />
                  </button>
                  <input ref={fileInputRef} type="file" accept=".jpeg,.jpg,.png,.pdf,.xls,.xlsx" style={{ display: 'none' }} onChange={handleAttachmentChange} />
                  <input
                    type="text"
                    placeholder="Aa"
                    className="chat-input"
                    value={messageInput}
                    onChange={e => setMessageInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                  />
                  <button className="chat-send-button" onClick={handleSendMessage} disabled={uploadingAttachment || (!messageInput.trim() && !pendingAttachment)}>
                    <img src={sendIcon} alt="Send" width="20" height="20" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </>
  );
}
