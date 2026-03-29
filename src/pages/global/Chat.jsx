import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  collection,
  getDocs,
  doc,
  getDoc,
  addDoc,
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
import Header from '../../components/Header';
import '../../styles/Chat.css';
import attachIcon from '../../assets/chatassets/attach.svg';
import sendIcon from '../../assets/chatassets/send.svg';

// Module-level cache — persists for the entire browser session, not just one render
const _avatarCache = {};

export default function Chat() {
  const { missionId } = useParams();
  const navigate = useNavigate();

  const [missions, setMissions] = useState([]);
  const [selectedMission, setSelectedMission] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastMessages, setLastMessages] = useState({});
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [avatarCache, setAvatarCache] = useState({});
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const fileInputRef = useRef(null);
  const MESSAGES_PER_PAGE = 20; //pwede ichange to para ma-adjust yung messages per load
  const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]);
  const MAX_IMAGE_DIMENSION = 1280;
  const IMAGE_QUALITY = 0.7;

  // Fetch all missions for the user
  useEffect(() => {
    const fetchMissions = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const missionsArray = [];
        const missionsRef = collection(db, 'missions');
        const allMissionsSnap = await getDocs(missionsRef);

        for (const missionDoc of allMissionsSnap.docs) {
          const mId = missionDoc.id;
          const missionData = missionDoc.data();
          let userRoleInMission = null;

          // Volunteer
          const volunteerSnap = await getDoc(
            doc(db, 'missions', mId, 'volunteer', user.uid)
          );
          if (volunteerSnap.exists()) userRoleInMission = 'volunteer';

          // Faculty
          if (!userRoleInMission) {
            const facultySnap = await getDoc(
              doc(db, 'missions', mId, 'faculty', user.uid)
            );
            if (facultySnap.exists()) userRoleInMission = 'faculty';
          }

          // Partner
          if (!userRoleInMission) {
            const partnerSnap = await getDoc(
              doc(db, 'missions', mId, 'partner', user.uid)
            );
            if (partnerSnap.exists()) userRoleInMission = 'partner';
          }

          // Admin
          const userSnap = await getDoc(doc(db, 'users', user.uid));
          const isAdmin =
            userSnap.exists() && userSnap.data().role === 'admin';

          if (userRoleInMission || isAdmin) {
            missionsArray.push({
              id: mId,
              title: missionData.title || 'Untitled Mission',
              description: missionData.description || '',
              date: missionData.targetDate || '',
              role: userRoleInMission || 'admin'
            });
          }
        }

        setMissions(missionsArray);

        if (missionId) {
          const found = missionsArray.find(m => m.id === missionId);
          if (found) setSelectedMission(found);
        } else if (missionsArray.length > 0) {
          setSelectedMission(missionsArray[0]);
        }

        setLoading(false);
      } catch (err) {
        console.error('Error fetching missions:', err);
        setLoading(false);
      }
    };

    fetchMissions();
  }, [missionId]);

  // Fetch last message per mission
  useEffect(() => {
    const fetchLastMessages = async () => {
      const lastMsgs = {};

      for (const mission of missions) {
        try {
          const q = query(
            collection(db, 'missions', mission.id, 'chat'),
            orderBy('timestamp', 'desc')
          );

          const snapshot = await getDocs(q);
          const lastMsg = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .find(msg => msg.id !== '_meta');

          if (lastMsg) {
            lastMsgs[mission.id] =
              lastMsg.text || lastMsg.fileName || 'Attachment';
          }
        } catch (err) {
          console.error('Error fetching last message:', err);
        }
      }

      setLastMessages(lastMsgs);
    };

    if (missions.length > 0) fetchLastMessages();
  }, [missions]);

  // Real-time messages with pagination
  useEffect(() => {
    if (!selectedMission) return;
// Fetch participants
    const fetchParticipants = async () => {
      try {
        const participantsData = await getChatParticipants(selectedMission.id);
        const allParticipants = [
          ...participantsData.volunteers,
          ...participantsData.faculty,
          ...participantsData.partners,
          ...participantsData.admins
        ];
        setParticipants(allParticipants);
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
      alert('Only JPEG, PNG, PDF, and Excel files are allowed.');
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
      alert('Failed to upload attachment. Please try again.');
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

  // Chat is read-only 1 week after the mission's target date
  const isChatLocked = (() => {
    if (!selectedMission?.date) return false;
    const missionEnd = new Date(selectedMission.date);
    if (isNaN(missionEnd.getTime())) return false;
    return Date.now() > missionEnd.getTime() + 7 * 24 * 60 * 60 * 1000;
  })();

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
        {/* Sidebar */}
        <div className="chat-sidebar">
          <div className="chat-sidebar-header">
            <h2>Chats</h2>
          </div>

          <div className="chat-sidebar-search">
            <input
              type="text"
              placeholder="Search"
              className="chat-search-input"
            />
          </div>

          <div className="chat-sidebar-list">
            {missions.length === 0 ? (
              <div className="chat-no-missions">No chats yet</div>
            ) : (
              missions.map(mission => (
                <button
                  key={mission.id}
                  className={`chat-sidebar-item ${
                    selectedMission?.id === mission.id ? 'active' : ''
                  }`}
                  onClick={() => handleSelectMission(mission)}
                >
                  <div className="chat-sidebar-avatar">
                    {mission.title.charAt(0).toUpperCase()}
                  </div>
                  <div className="chat-sidebar-item-content">
                    <h3>{mission.title}</h3>
                    <p>{lastMessages[mission.id] || 'No messages yet'}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="chat-main">
          {selectedMission ? (
            <>
              <div className="chat-header">
                <div className="chat-header-avatar">
                  {selectedMission.title.charAt(0).toUpperCase()}
                </div>
                <div className="chat-header-content">
                  <h2>{selectedMission.title}</h2>
                </div>
              </div>

              <div className="chat-messages">
                {messages.length === 0 ? (
                  <div className="chat-empty">
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  <>
                    {hasMoreMessages && (
                      <button
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                        className="chat-load-more-btn"
                      >
                        {loadingMore ? 'Loading...' : 'Load earlier messages'}
                      </button>
                    )}
                    {messages.map(message => (
                      <div
                        key={message.id}
                        className={`chat-message ${
                          message.senderId === auth.currentUser?.uid
                            ? 'sent'
                            : 'received'
                        }`}
                      >
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
                            <div className="chat-message-sender">
                              {message.senderName}
                            </div>
                          )}
                          <div className="chat-message-bubble">
                              {message.type === 'attachment' ? (
                                <div className="chat-message-text">
                                  {message.fileType?.startsWith('image/') ? (
                                    <a
                                      href={message.fileUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      <img
                                        src={message.fileUrl}
                                        alt={message.fileName || 'Attachment'}
                                        style={{ maxWidth: 220, borderRadius: 8 }}
                                      />
                                    </a>
                                  ) : (
                                    <a
                                      href={message.fileUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      {message.fileName || 'Attachment'}
                                    </a>
                                  )}
                                </div>
                              ) : (
                                <div className="chat-message-text">
                                  {message.text}
                                </div>
                              )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>

              {!isChatLocked && pendingAttachment && (
                <div className="chat-attachment-preview">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {pendingAttachment.type.startsWith('image/') ? (
                      <img
                        src={URL.createObjectURL(pendingAttachment)}
                        alt="preview"
                        style={{ width: '40px', height: '40px', borderRadius: '4px', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ width: '40px', height: '40px', backgroundColor: '#ddd', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>📄</div>
                    )}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>{pendingAttachment.name}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>{(pendingAttachment.size / 1024).toFixed(2)} KB</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveAttachment}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}
                  >
                    ✕
                  </button>
                </div>
              )}

              {isChatLocked ? (
                <div className="chat-locked-notice">
                  <span>This chat is closed</span>
                </div>
              ) : (
                <div className="chat-input-area">
                  <button
                    type="button"
                    className="chat-input-icon"
                    onClick={handleAttachmentClick}
                    disabled={uploadingAttachment}
                  >
                    <img src={attachIcon} alt="Attach" width="20" height="20" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpeg,.jpg,.png,.pdf,.xls,.xlsx"
                    style={{ display: 'none' }}
                    onChange={handleAttachmentChange}
                  />

                  <input
                    type="text"
                    placeholder="Aa"
                    className="chat-input"
                    value={messageInput}
                    onChange={e => setMessageInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />

                  <button
                    className="chat-send-button"
                    onClick={handleSendMessage}
                    disabled={uploadingAttachment || (!messageInput.trim() && !pendingAttachment)}
                  >
                    <img src={sendIcon} alt="Send" width="20" height="20" />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="chat-empty-state">
              <p>Select a conversation to start chatting</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
