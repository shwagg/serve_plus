import { useEffect, useState } from 'react';
import { collection, getDocs, doc, getDoc, query, where, orderBy, limit } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import './styles/ChatModal.css';
import { Link } from 'react-router-dom';

export default function ChatModal({ isOpen, onClose, onSelectMission }) {
  const [missions, setMissions] = useState([]);
  const [filteredMissions, setFilteredMissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    const fetchUserMissions = async () => {
      setLoading(true);
      setError(null);

      try {
        const user = auth.currentUser;
        if (!user) {
          setMissions([]);
          setFilteredMissions([]);
          return;
        }

        const userMissionsSet = new Set();

        // Get all missions where user is a volunteer
        const missionsRef = collection(db, 'missions');
        const allMissionsSnap = await getDocs(missionsRef);

        // Get user info once
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        const userRole = userSnap.exists() ? userSnap.data().role : null;
        const isAdmin = userRole === 'admin';

        for (const missionDoc of allMissionsSnap.docs) {
          const missionId = missionDoc.id;
          const missionData = missionDoc.data();
          let userRoleInMission = null;

          // Check if user is a volunteer
          const volunteerRef = doc(db, 'missions', missionId, 'volunteer', user.uid);
          const volunteerSnap = await getDoc(volunteerRef);
          if (volunteerSnap.exists()) {
            userRoleInMission = 'volunteer';
          }

          // Check if user is faculty
          if (!userRoleInMission) {
            const facultyRef = doc(db, 'missions', missionId, 'faculty', user.uid);
            const facultySnap = await getDoc(facultyRef);
            if (facultySnap.exists()) {
              userRoleInMission = 'faculty';
            }
          }

          // Check if user is partner
          if (!userRoleInMission) {
            const partnerRef = doc(db, 'missions', missionId, 'partner', user.uid);
            const partnerSnap = await getDoc(partnerRef);
            if (partnerSnap.exists()) {
              userRoleInMission = 'partner';
            }
          }

          // If user has a role in mission or is admin, add to missions
          if (userRoleInMission || isAdmin) {
            const lastMessage = await getLastMessage(missionId);
            
            userMissionsSet.add({
              id: missionId,
              title: missionData.title || 'Untitled Mission',
              description: missionData.description || '',
              date: missionData.date || '',
              role: userRoleInMission || 'admin',
              lastMessage: lastMessage || 'Start a conversation...',
            });
          }
        }

        const missionsArray = Array.from(userMissionsSet);
        setMissions(missionsArray);
        setFilteredMissions(missionsArray);
      } catch (err) {
        console.error('Error fetching missions:', err);
        setError('Failed to load conversations');
      } finally {
        setLoading(false);
      }
    };

    fetchUserMissions();
  }, [isOpen]);

  // Get last message chat
  const getLastMessage = async (missionId) => {
    try {
      const user = auth.currentUser;
      const chatRef = collection(db, 'missions', missionId, 'chat');
      const q = query(
        chatRef,
        where('__name__', '!=', '_meta'),
        orderBy('timestamp', 'desc'),
        limit(1)
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) return '';
      const lastMsg = snapshot.docs[0].data();
      
      // If sender is not the current user, show their name with the message
      if (lastMsg.senderId !== user.uid) {
        const senderName = lastMsg.senderName || 'User';
        return `${senderName}: ${lastMsg.text || 'Message sent'}`;
      }
      
      // If it's the current user's message, show "You" with the message
      return `You: ${lastMsg.text || 'Message sent'}`;
    } catch (err) {
      return '';
    }
  };

  // Search query handler
  const handleSearch = (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredMissions(missions);
    } else {
      const filtered = missions.filter(mission =>
        mission.title.toLowerCase().includes(query.toLowerCase()) ||
        mission.description.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredMissions(filtered);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="chat-modal-overlay" onClick={onClose}>
      <div className="chat-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="chat-modal-header">
          <h2>Chats</h2>
          <Link to="/chat" className="chat-view-all">View all Chats</Link>
        </div>

        {/* Search Bar */}
        <div className="chat-modal-search-wrapper">
          <input
            type="text"
            placeholder="Search"
            className="chat-modal-search"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        {/* Content */}
        <div className="chat-modal-body">
          {loading ? (
            <div className="chat-modal-loading">Loading conversations...</div>
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
                  onClick={() => onSelectMission(mission.id)}
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
      </div>
    </div>
  );
}
