import { useEffect, useState, useRef, useCallback } from 'react';
import {
  collection, getDocs, doc, getDoc, addDoc, setDoc,
  query, where, orderBy, limit, onSnapshot, serverTimestamp
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { Link } from 'react-router-dom';
import './styles/ChatModal.css';
import chatIcon from '../assets/headassets/Chat Icon.svg';
import { announceHeaderModalOpen, useCloseOnHeaderModalOpen } from '../utils/modalCoordinator';

export default function ChatModal() {
  // ── Dropdown state ───────────────────────────────────
  const [isOpen, setIsOpen]                     = useState(false);
  const [missions, setMissions]                 = useState([]);
  const [filteredMissions, setFilteredMissions] = useState([]);
  const [loading, setLoading]                   = useState(false);
  const [error, setError]                       = useState(null);
  const [searchQuery, setSearchQuery]           = useState('');

  // ── Conversation (chat) state ────────────────────────
  const [activeConvo, setActiveConvo]     = useState(null);
  const [messages, setMessages]           = useState([]);
  const [messageInput, setMessageInput]   = useState('');
  const [sending, setSending]             = useState(false);
  const [avatarCache, setAvatarCache]     = useState({});

  const containerRef  = useRef(null);
  const buttonRef     = useRef(null);
  const messagesEndRef = useRef(null);
  const listenerRef   = useRef(null);

  // ── Close & reset on dropdown close ─────────────────
  const resetDropdown = useCallback((restoreFocus = false) => {
    setIsOpen(false);
    setActiveConvo(null);
    setMessages([]);
    setMessageInput('');
    setSearchQuery('');
    if (restoreFocus) buttonRef.current?.focus();
  }, []);

  const closeAll = useCallback(() => {
    resetDropdown(true);
  }, [resetDropdown]);

  const closeForOtherHeaderModal = useCallback(() => {
    resetDropdown(false);
  }, [resetDropdown]);

  useCloseOnHeaderModalOpen('chat', closeForOtherHeaderModal);

  // ── Fetch missions when dropdown opens ───────────────
  useEffect(() => {
    if (!isOpen) return;
    fetchUserMissions();
  }, [isOpen]);

  // ── Click-outside to close ───────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handle = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target))
        closeAll();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [isOpen, closeAll]);

  // ── Real-time messages listener ──────────────────────
  useEffect(() => {
    if (listenerRef.current) { listenerRef.current(); listenerRef.current = null; }
    if (!activeConvo) { setMessages([]); return; }

    const q = query(
      collection(db, 'missions', activeConvo.id, 'chat'),
      orderBy('timestamp', 'asc'),
      limit(50)
    );
    listenerRef.current = onSnapshot(q, (snap) => {
      setMessages(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(m => m.id !== '_meta')
      );
    });
    return () => { if (listenerRef.current) listenerRef.current(); };
  }, [activeConvo]);

  // ── Auto-scroll to latest message ───────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Fetch avatars for senders not yet cached ─────────
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

  // ── isChatLocked ─────────────────────────────────────
  const isChatLocked = (() => {
    if (!activeConvo?.date) return false;
    const end = new Date(activeConvo.date);
    if (isNaN(end.getTime())) return false;
    return Date.now() > end.getTime() + 7 * 24 * 60 * 60 * 1000;
  })();

  // ── Data fetching ─────────────────────────────────────
  const getLastMessage = async (missionId) => {
    try {
      const user = auth.currentUser;
      const q = query(
        collection(db, 'missions', missionId, 'chat'),
        where('__name__', '!=', '_meta'),
        orderBy('timestamp', 'desc'),
        limit(1)
      );
      const snap = await getDocs(q);
      if (snap.empty) return '';
      const msg = snap.docs[0].data();
      return msg.senderId === user.uid
        ? `You: ${msg.text || 'Attachment'}`
        : `${msg.senderName || 'User'}: ${msg.text || 'Attachment'}`;
    } catch { return ''; }
  };

  const fetchUserMissions = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = auth.currentUser;
      if (!user) { setMissions([]); setFilteredMissions([]); return; }

      const userMissionsSnap = await getDocs(
        collection(db, 'userMissions', user.uid, 'missions')
      );

      if (!userMissionsSnap.empty) {
        const arr = await Promise.all(
          userMissionsSnap.docs.map(async (d) => {
            const data = d.data();
            return {
              id:          d.id,
              title:       data.title || 'Untitled Mission',
              description: data.description || '',
              date:        data.date || '',
              role:        data.role || 'volunteer',
              lastMessage: (await getLastMessage(d.id)) || 'Start a conversation…',
            };
          })
        );
        setMissions(arr);
        setFilteredMissions(arr);
        return;
      }

      // userMissions is empty — could be existing user before the index existed.
      // Fall back to full scan, then self-heal by writing the index.
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      const userRole = userSnap.exists() ? userSnap.data().role : null;
      const isAdmin  = userRole === 'admin';

      const allSnap = await getDocs(collection(db, 'missions'));
      const found = [];

      await Promise.all(allSnap.docs.map(async (missionDoc) => {
        const mId   = missionDoc.id;
        const mData = missionDoc.data();
        let role    = null;

        if (isAdmin) {
          role = 'admin';
        } else {
          const [vSnap, fSnap, pSnap] = await Promise.all([
            getDoc(doc(db, 'missions', mId, 'volunteer', user.uid)),
            getDoc(doc(db, 'missions', mId, 'faculty',   user.uid)),
            getDoc(doc(db, 'missions', mId, 'partner',   user.uid)),
          ]);
          if (vSnap.exists()) role = 'volunteer';
          else if (fSnap.exists()) role = 'faculty';
          else if (pSnap.exists()) role = 'partner';
        }

        if (role) {
          found.push({
            id:          mId,
            title:       mData.title       || 'Untitled Mission',
            description: mData.description || '',
            date:        mData.targetDate  || '',
            role,
          });
          // Self-heal: write reverse index so next open is instant
          setDoc(doc(db, 'userMissions', user.uid, 'missions', mId), {
            title:    mData.title || 'Untitled Mission',
            role,
            date:     mData.targetDate || '',
            joinedAt: serverTimestamp(),
          }).catch(() => {});
        }
      }));

      const arr = await Promise.all(
        found.map(async (m) => ({
          ...m,
          lastMessage: (await getLastMessage(m.id)) || 'Start a conversation…',
        }))
      );
      setMissions(arr);
      setFilteredMissions(arr);
    } catch (err) {
      console.error('Error fetching missions:', err);
      setError('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = useCallback((q) => {
    setSearchQuery(q);
    if (!q.trim()) { setFilteredMissions(missions); return; }
    const lq = q.toLowerCase();
    setFilteredMissions(missions.filter(m =>
      m.title.toLowerCase().includes(lq) ||
      m.description.toLowerCase().includes(lq)
    ));
  }, [missions]);

  // ── Send message ──────────────────────────────────────
  const handleSend = async () => {
    if (!messageInput.trim() || !activeConvo || isChatLocked || sending) return;
    setSending(true);
    try {
      const user = auth.currentUser;
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      const userData = userSnap.exists() ? userSnap.data() : {};
      await addDoc(collection(db, 'missions', activeConvo.id, 'chat'), {
        senderId:   user.uid,
        senderName: userData.name || user.displayName || 'User',
        senderRole: activeConvo.role,
        text:       messageInput.trim(),
        timestamp:  serverTimestamp(),
        type:       'text',
      });
      setMessageInput('');
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const currentUid = auth.currentUser?.uid;

  // ── Render ────────────────────────────────────────────
  return (
    <div className="chat-dropdown-container" ref={containerRef}>
      <button
        ref={buttonRef}
        className="icon-button"
        aria-label="Chat"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => setIsOpen(prev => {
          if (prev) return false;
          announceHeaderModalOpen('chat');
          return true;
        })}
      >
        <img src={chatIcon} alt="" width="24" height="24" aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          className={`chat-dropdown${activeConvo ? ' chat-dropdown--convo' : ''}`}
          role="dialog"
          aria-label="Chats"
          aria-modal="true"
        >
          {/* ── LIST VIEW ── */}
          {!activeConvo && (
            <>
              <div className="chat-dropdown-header">
                <h3>Chats</h3>
                <div className="chat-dropdown-header-actions">
                  <Link to="/chat" className="chat-view-all" onClick={closeAll}>View all</Link>
                  <button className="chat-close-btn" onClick={closeAll} aria-label="Close">×</button>
                </div>
              </div>

              <div className="chat-modal-search-wrapper">
                <input
                  type="text"
                  placeholder="Search"
                  className="chat-modal-search"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>

              <div className="chat-modal-body">
                {loading ? (
                  <div className="chat-modal-loading">Loading conversations…</div>
                ) : error ? (
                  <div className="chat-modal-error">{error}</div>
                ) : filteredMissions.length === 0 ? (
                  <div className="chat-modal-empty">
                    <p>{searchQuery ? 'No conversations found' : 'No conversations yet'}</p>
                    <p className="chat-modal-empty-hint">
                      {searchQuery ? 'Try a different search' : 'Join a mission to start chatting'}
                    </p>
                  </div>
                ) : (
                  <div className="chat-modal-list">
                    {filteredMissions.map((mission) => (
                      <button
                        key={mission.id}
                        className="chat-modal-item"
                        onClick={() => setActiveConvo(mission)}
                      >
                        <div className="chat-modal-avatar-wrapper">
                          <div className="chat-modal-avatar">
                            {mission.title.charAt(0).toUpperCase()}
                          </div>
                        </div>
                        <div className="chat-modal-item-content">
                          <h3 className="chat-modal-item-title">{mission.title}</h3>
                          <p className="chat-modal-item-preview">{mission.lastMessage}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── CHAT VIEW ── */}
          {activeConvo && (
            <>
              <div className="chat-convo-header">
                <div className="chat-convo-header-toprow">
                  <button
                    className="chat-convo-back-btn"
                    onClick={() => { setActiveConvo(null); setMessages([]); setMessageInput(''); }}
                    aria-label="Back to chats"
                  >
                    ‹
                  </button>
                  <div className="chat-convo-avatar">
                    {activeConvo.title.charAt(0).toUpperCase()}
                  </div>
                  <div className="chat-convo-title-wrap">
                    <span className="chat-convo-title">{activeConvo.title}</span>
                  </div>
                  <div className="chat-convo-header-actions">
                    <Link
                      to={`/chat/${activeConvo.id}`}
                      className="chat-view-all"
                      onClick={closeAll}
                      title="Open full chat"
                    >
                      ↗
                    </Link>
                    <button className="chat-close-btn" onClick={closeAll} aria-label="Close">×</button>
                  </div>
                </div>
                <div className="chat-convo-mission-label" title={activeConvo.title}>
                  {activeConvo.title}
                </div>
              </div>

              <div className="chat-convo-messages">
                {messages.length === 0 ? (
                  <div className="chat-convo-empty">No messages yet. Say something!</div>
                ) : (
                  messages.map((msg) => {
                    const isSent = msg.senderId === currentUid;
                    return (
                      <div key={msg.id} className={`chat-convo-msg ${isSent ? 'sent' : 'received'}`}>
                        {!isSent && (
                          <div className="chat-convo-msg-avatar">
                            {avatarCache[msg.senderId] ? (
                              <img src={avatarCache[msg.senderId]} alt={msg.senderName} className="chat-convo-msg-avatar-img" />
                            ) : (
                              msg.senderName?.charAt(0).toUpperCase() || 'U'
                            )}
                          </div>
                        )}
                        <div className="chat-convo-msg-body">
                          {!isSent && (
                            <span className="chat-convo-msg-sender">{msg.senderName}</span>
                          )}
                          <div className="chat-convo-msg-bubble">
                            {msg.type === 'attachment' ? (
                              msg.fileType?.startsWith('image/') ? (
                                <a href={msg.fileUrl} target="_blank" rel="noreferrer">
                                  <img src={msg.fileUrl} alt={msg.fileName} className="chat-convo-msg-img" />
                                </a>
                              ) : (
                                <a href={msg.fileUrl} target="_blank" rel="noreferrer" className="chat-convo-msg-file">
                                  📄 {msg.fileName}
                                </a>
                              )
                            ) : (
                              msg.text
                            )}
                          </div>
                          <span className="chat-convo-msg-time">{formatTime(msg.timestamp)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {isChatLocked ? (
                <div className="chat-convo-locked">This chat is closed</div>
              ) : (
                <div className="chat-convo-input-area">
                  <input
                    type="text"
                    className="chat-convo-input"
                    placeholder="Aa"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                    }}
                  />
                  <button
                    className="chat-convo-send-btn"
                    onClick={handleSend}
                    disabled={sending || !messageInput.trim()}
                    aria-label="Send"
                  >
                    ➤
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {isOpen && (
        <div className="chat-backdrop" onClick={closeAll} aria-hidden="true" />
      )}
    </div>
  );
}
