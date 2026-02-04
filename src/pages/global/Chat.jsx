import { useEffect, useState } from 'react';
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
import { auth, db } from '../../firebaseConfig';
import { getChatParticipants } from '../../utils/chatUtils';
import Header from '../../components/Header';
import '../../styles/Chat.css';
import attachIcon from '../../assets/chatassets/attach.svg';
import sendIcon from '../../assets/chatassets/send.svg';

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
  const MESSAGES_PER_PAGE = 20; //pwede ichange to para ma-adjust yung messages per load

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
              date: missionData.date || '',
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

          if (lastMsg) lastMsgs[mission.id] = lastMsg.text || '';
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

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedMission) return;

    try {
      const user = auth.currentUser;
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.exists() ? userDoc.data() : {};

      await addDoc(
        collection(db, 'missions', selectedMission.id, 'chat'),
        {
          senderId: user.uid,
          senderName: userData.name || user.displayName || 'User',
          senderRole: selectedMission.role,
          text: messageInput.trim(),
          timestamp: serverTimestamp(),
          type: 'text'
        }
      );

      setMessageInput('');
    } catch (err) {
      console.error('Error sending message:', err);
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
                            {message.senderName?.charAt(0).toUpperCase() || 'U'}
                          </div>
                        )}
                        <div className="chat-message-content">
                          {message.senderId !== auth.currentUser?.uid && (
                            <div className="chat-message-sender">
                              {message.senderName}
                            </div>
                          )}
                          <div className="chat-message-bubble">
                            <div className="chat-message-text">
                              {message.text}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>

              <div className="chat-input-area">
                <button className="chat-input-icon">
                  <img src={attachIcon} alt="Attach" width="20" height="20" />
                </button>

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
                >
                  <img src={sendIcon} alt="Send" width="20" height="20" />
                </button>
              </div>
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
