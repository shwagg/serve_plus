import React, { useEffect, useState } from "react";
import { db } from "../../firebaseConfig";
import { collection, getDocs, doc, updateDoc, deleteField } from "firebase/firestore";
import "../../styles/RosterAccountManagement.css";
import ViewAccountIcon from "../../components/icons/ViewAccount.svg";
import ChangeIcon from "../../components/icons/Change.svg";

export default function RosterAccountManagement() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingRoleUserId, setEditingRoleUserId] = useState(null);
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedPosition, setSelectedPosition] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
    // Department options for faculty
    const departments = [
      "College of Arts and Science (CAS)",
      "College of Computer and Information Science (CCIS)",
      "College of Health Sciences (CHS)",
      "College of Nursing (CN)",
      "College of Maritime Education and Training (CMET)",
      "E.T. Yuchengco College of Business (ETYCB)",
      "Mapua-Laguna Institute of Aviation (MIA)",
      "Mapua Institute of Technology at Laguna (MITL)",
      "Mapua MCL Senior High School (SHS)"
    ];
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState("overall");
  const [roleFilter, setRoleFilter] = useState("overall");

  // Position options based on role
  const positionsByRole = {
    faculty: [
      "regular",
      "program chair",
      "cluster head",
      "college engagement head",
      "student organization adviser",
      "college dean",
      "shs principal",
      "sao director",
      "department head"
    ],
    admin: [
      "director",
      "regular"
    ]
  }; 

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [users, searchTerm, statusFilter, roleFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const usersCollection = collection(db, "users");
      const querySnapshot = await getDocs(usersCollection);
      const usersData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setUsers(usersData);
    } catch (err) {
      console.error("Error fetching users:", err);
      setUsers([]);
    }
    setLoading(false);
  };

  const applyFilters = () => {
    let filtered = [...users];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter((user) =>
        user.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter === "active") {
      filtered = filtered.filter((user) => user.status?.toLowerCase() === "active");
    } else if (statusFilter === "inactive") {
      filtered = filtered.filter((user) => user.status?.toLowerCase() === "inactive");
    }

    // Apply role filter
    if (roleFilter !== "overall") {
      if (roleFilter === "points") {
        filtered = filtered.filter((user) => user.points && user.points > 0);
      } else {
        filtered = filtered.filter(
          (user) => user.role?.toLowerCase() === roleFilter.replace("-", " ")
        );
      }
    }

    setFilteredUsers(filtered);
  };

  const handleStatusFilterChange = (filter) => {
    setStatusFilter(filter);
  };

  const handleRoleFilterChange = (filter) => {
    setRoleFilter(filter);
  };

  const handleChangeRoleClick = (userId, currentRole, currentPosition, currentDepartment) => {
    setEditingRoleUserId(userId);
    setSelectedRole(currentRole || "");
    setSelectedPosition(currentPosition || "");
    setSelectedDepartment(currentDepartment || "");
  };

  const handleRoleChange = async (userId) => {
    if (!selectedRole) return;

    // Check if position is required but not selected
    if ((selectedRole === "faculty" || selectedRole === "admin") && !selectedPosition) {
      alert("Please select a position for this role.");
      return;
    }
    // Check if department is required but not selected (faculty only)
    if (selectedRole === "faculty" && !selectedDepartment) {
      alert("Please select a department for faculty role.");
      return;
    }

    try {
      const userRef = doc(db, "users", userId);
      // Find the current user object
      const currentUser = users.find(u => u.id === userId) || {};
      let updateData = { role: selectedRole };

      // Student role: delete position, add student fields
      if (selectedRole === "student") {
        updateData = {
          ...updateData,
          position: deleteField(),
          department: deleteField(),
          skills: currentUser.skills || [],
          eventHistory: currentUser.eventHistory || [],
          interests: currentUser.interests || [],
          level: currentUser.level || 1,
          levelprogress: currentUser.levelprogress || 0
        };
      } else if (selectedRole === "faculty") {
        // Faculty: set position and department, delete student fields
        updateData = {
          ...updateData,
          position: selectedPosition,
          department: selectedDepartment,
          skills: deleteField(),
          eventHistory: deleteField(),
          interests: deleteField(),
          level: deleteField(),
          levelProgress: deleteField()
        };
      } else if (selectedRole === "admin") {
        // Admin: set position, delete department and student fields
        updateData = {
          ...updateData,
          position: selectedPosition,
          department: deleteField(),
          skills: deleteField(),
          eventHistory: deleteField(),
          interests: deleteField(),
          level: deleteField(),
          levelProgress: deleteField()
        };
      } else {
        // Partner or other roles: delete both position, department, and student fields
        updateData = {
          ...updateData,
          position: deleteField(),
          department: deleteField(),
          skills: deleteField(),
          eventHistory: deleteField(),
          interests: deleteField(),
          level: deleteField(),
          levelProgress: deleteField()
        };
      }

      await updateDoc(userRef, updateData);

      // Update local state
      setUsers(users.map(user => {
        if (user.id !== userId) return user;
        let updatedUser = { ...user, role: selectedRole };
        if (selectedRole === "student") {
          updatedUser = {
            ...updatedUser,
            position: undefined,
            department: undefined,
            skills: user.skills || [],
            eventHistory: user.eventHistory || [],
            interests: user.interests || [],
            level: user.level || 1,
            levelprogress: user.levelprogress || 0
          };
        } else if (selectedRole === "faculty") {
          updatedUser = {
            ...updatedUser,
            position: selectedPosition,
            department: selectedDepartment
          };
          delete updatedUser.skills;
          delete updatedUser.eventHistory;
          delete updatedUser.interests;
          delete updatedUser.level;
          delete updatedUser.levelprogress;
        } else if (selectedRole === "admin") {
          updatedUser = {
            ...updatedUser,
            position: selectedPosition
          };
          delete updatedUser.department;
          delete updatedUser.skills;
          delete updatedUser.eventHistory;
          delete updatedUser.interests;
          delete updatedUser.level;
          delete updatedUser.levelprogress;
        } else {
          updatedUser = {
            ...updatedUser
          };
          delete updatedUser.position;
          delete updatedUser.department;
          delete updatedUser.skills;
          delete updatedUser.eventHistory;
          delete updatedUser.interests;
          delete updatedUser.level;
          delete updatedUser.levelprogress;
        }
        return updatedUser;
      }));

      setEditingRoleUserId(null);
      setSelectedRole("");
      setSelectedPosition("");
      setSelectedDepartment("");
    } catch (err) {
      console.error("Error updating role:", err);
      alert("Failed to update role. Please try again.");
    }
  };

  const handleCancelRoleChange = () => {
    setEditingRoleUserId(null);
    setSelectedRole("");
    setSelectedPosition("");
    setSelectedDepartment("");
  };

  return (
    <div className="roster-container">
      <div className="roster-wrapper">
        {/* Header */}
        <div className="roster-header">
          <h1 className="roster-title">
            Roster Account Management
          </h1>
          
          {/* Status Filters */}
          <div className="status-filters">
            <label className="filter-label">
              <input
                type="radio"
                name="status"
                checked={statusFilter === "overall"}
                onChange={() => handleStatusFilterChange("overall")}
                className="filter-overall"
              />
              <span>Overall</span>
            </label>
            <label className="filter-label">
              <input
                type="radio"
                name="status"
                checked={statusFilter === "active"}
                onChange={() => handleStatusFilterChange("active")}
                className="filter-active"
              />
              <span>Active</span>
            </label>
            <label className="filter-label">
              <input
                type="radio"
                name="status"
                checked={statusFilter === "inactive"}
                onChange={() => handleStatusFilterChange("inactive")}
                className="filter-inactive"
              />
              <span>Inactive</span>
            </label>
          </div>
        </div>

        {/* Search and Role Filters */}
        <div className="search-filter-row">
          {/* Search Bar */}
          <div className="search-wrapper">
            <input
              type="text"
              placeholder="Search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            <svg 
              className="search-icon"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Role Filters */}
          <div className="role-filters">
            <label className="filter-label">
              <input
                type="radio"
                name="role"
                checked={roleFilter === "overall"}
                onChange={() => handleRoleFilterChange("overall")}
                className="filter-role"
              />
              <span>Overall</span>
            </label>
            <label className="filter-label">
              <input
                type="radio"
                name="role"
                checked={roleFilter === "volunteer"}
                onChange={() => handleRoleFilterChange("volunteer")}
                className="filter-role"
              />
              <span>Volunteer</span>
            </label>
            <label className="filter-label">
              <input
                type="radio"
                name="role"
                checked={roleFilter === "student-leader"}
                onChange={() => handleRoleFilterChange("student-leader")}
                className="filter-role"
              />
              <span>Student Leader</span>
            </label>
            <label className="filter-label">
              <input
                type="radio"
                name="role"
                checked={roleFilter === "faculty"}
                onChange={() => handleRoleFilterChange("faculty")}
                className="filter-role"
              />
              <span>Faculty</span>
            </label>
            <label className="filter-label">
              <input
                type="radio"
                name="role"
                checked={roleFilter === "partner"}
                onChange={() => handleRoleFilterChange("partner")}
                className="filter-role"
              />
              <span>Partner</span>
            </label>
            <label className="filter-label">
              <input
                type="radio"
                name="role"
                checked={roleFilter === "points"}
                onChange={() => handleRoleFilterChange("points")}
                className="filter-role"
              />
              <span>Points</span>
            </label>
          </div>
        </div>

        <hr className="roster-divider" />

        {/* Table */}
        <div className="table-container">
          {loading ? (
            <div className="loading-message">
              Loading users...
            </div>
          ) : (
            <table className="roster-table">
              <thead>
                <tr>
                  <th className="text-left"> </th>
                  <th className="text-left">Name</th>
                  <th className="text-center">Points</th>
                  <th className="text-center">Role</th>
                  <th className="text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="no-users-message">
                      No users found
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user, index) => (
                    <tr key={user.id}>
                      <td className="row-number">
                        {index + 1}
                      </td>
                      <td className="user-name">
                        {user.name || "N/A"}
                      </td>
                      <td className="text-center points-cell">
                        {user.points ? `${user.points} PTS` : "/"}
                      </td>
                      <td className="text-center role-cell">
                        {editingRoleUserId === user.id ? (
                          <div className="role-edit-container">
                            <select 
                              value={selectedRole} 
                              onChange={(e) => {
                                setSelectedRole(e.target.value);
                                setSelectedPosition(""); // Reset position when role changes
                                setSelectedDepartment(""); // Reset department when role changes
                              }}
                              className="role-select"
                            >
                              <option value="student">Student</option>
                              <option value="faculty">Faculty</option>
                              <option value="partner">Partner</option>
                              <option value="admin">Admin</option>
                            </select>

                            {(selectedRole === "faculty" || selectedRole === "admin") && (
                              <select 
                                value={selectedPosition} 
                                onChange={(e) => setSelectedPosition(e.target.value)}
                                className="role-select"
                              >
                                <option value="">Select Position</option>
                                {positionsByRole[selectedRole]?.map((position) => (
                                  <option key={position} value={position}>
                                    {position}
                                  </option>
                                ))}
                              </select>
                            )}

                            {selectedRole === "faculty" && (
                              <select
                                value={selectedDepartment}
                                onChange={(e) => setSelectedDepartment(e.target.value)}
                                className="role-select"
                              >
                                <option value="">Select Department</option>
                                {departments.map((dept) => (
                                  <option key={dept} value={dept}>{dept}</option>
                                ))}
                              </select>
                            )}

                            <div className="role-edit-actions">
                              <button 
                                onClick={() => handleRoleChange(user.id)}
                                className="role-save-btn"
                              >
                                Save
                              </button>
                              <button 
                                onClick={handleCancelRoleChange}
                                className="role-cancel-btn"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="role-display">
                            <span>{user.role || "N/A"}</span>
                            <button
                              onClick={() => handleChangeRoleClick(user.id, user.role, user.position, user.department)}
                              className="change-role-btn"
                            >
                              <img src={ChangeIcon} alt="Change Role" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="text-center">
                        <span className={`status-badge ${user.status?.toLowerCase() === "active" ? "active" : "inactive"}`}>
                          {user.status || "N/A"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
