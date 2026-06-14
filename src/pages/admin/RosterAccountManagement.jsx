import {
  collection,
  deleteField,
  doc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useEffect, useState, useContext, useRef, useCallback } from "react";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ChangeIcon from "../../components/icons/Change.svg";
import { db, functions } from "../../firebaseConfig";
import { showConfirm, showToast } from "../../utils/toast";
import { logAudit } from "../../utils/auditLogger";
import { SessionContext } from "../../context/sessionContextCore";
import "../../styles/RosterAccountManagement.css";

const ROLE_OPTIONS = [
  { value: "student", label: "Volunteer" },
  { value: "faculty", label: "Faculty" },
  { value: "partner", label: "Partner" },
  { value: "admin", label: "Admin" },
  { value: "sysadmin", label: "System Admin" },
];

const BLACKBOARD_ALLOWED_ROLES = new Set(["student", "faculty"]);
const NON_BLACKBOARD_ALLOWED_ROLES = new Set(["partner", "admin", "sysadmin"]);
const TOTP_REQUIRED_ROLES = new Set(["student", "faculty", "admin"]);

const ROLE_FILTER_OPTIONS = [
  { value: "overall", label: "All" },
  { value: "student", label: "Volunteer" },
  { value: "faculty", label: "Faculty" },
  { value: "partner", label: "Partner" },
  { value: "admin", label: "Admin" },
];

const isBlackboardAccount = (user) =>
  user?.authProvider === "blackboard" ||
  Boolean(user?.blackboardId || user?.blackboardAuthUid);

const getAllowedRoleSet = (user) =>
  isBlackboardAccount(user) ? BLACKBOARD_ALLOWED_ROLES : NON_BLACKBOARD_ALLOWED_ROLES;

const getAssignableRoleOptions = (user) => {
  const allowedRoles = getAllowedRoleSet(user);
  return ROLE_OPTIONS.filter(({ value }) => allowedRoles.has(value));
};

const isRoleAllowedForAccount = (user, role) =>
  getAllowedRoleSet(user).has(String(role || "").toLowerCase());

const canResetTotpForUser = (user) =>
  TOTP_REQUIRED_ROLES.has(String(user?.role || "").toLowerCase());

const normalizeSearchText = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const getUserSearchText = (user) => {
  const fields = [
    user?.email,
    user?.name,
    user?.fullName,
    user?.displayName,
    user?.firstName,
    user?.lastName,
    user?.username,
    user?.id,
    user?.uid,
    user?.role,
    user?.status,
    user?.authProvider,
    user?.blackboardUsername,
    user?.blackboardId,
    user?.blackboardAuthUid,
    user?.organizationName,
    user?.department,
    user?.program,
    user?.position,
  ];

  return fields.map(normalizeSearchText).filter(Boolean).join(" ");
};

const userMatchesSearch = (user, query) => {
  const terms = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;

  const searchText = getUserSearchText(user);
  return terms.every((term) => searchText.includes(term));
};

const getUserFullName = (user) => {
  const nameFromParts = [
    user?.firstName,
    user?.middleInitial,
    user?.lastName,
  ]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ");

  return (
    user?.name ||
    user?.fullName ||
    user?.displayName ||
    nameFromParts ||
    "N/A"
  );
};

export default function RosterAccountManagement({ readOnly = false }) {
  const { userData: actorData } = useContext(SessionContext);
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingRoleUserId, setEditingRoleUserId] = useState(null);
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedPosition, setSelectedPosition] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totpResetRequests, setTotpResetRequests] = useState({});
  const [openActionUserId, setOpenActionUserId] = useState(null);
  const [totpActionUserId, setTotpActionUserId] = useState(null);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const actionMenuRef = useRef(null);
  const filterDropdownRef = useRef(null);
  const pageSize = 10;
  const canManageTotp = !readOnly && actorData?.role === "sysadmin";
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
    "Mapua MCL Senior High School (SHS)",
  ];

  // Filter states
  const [statusFilter] = useState("overall");
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
      "department head",
    ],
    admin: ["director", "regular"],
  };

  useEffect(() => {
    fetchUsers();
  }, []);

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

  const applyFilters = useCallback(() => {
    let filtered = [...users];

    // Apply search filter
    if (searchTerm.trim()) {
      filtered = filtered.filter((user) => userMatchesSearch(user, searchTerm));
    }

    // Apply status filter
    if (statusFilter === "active") {
      filtered = filtered.filter(
        (user) => user.status?.toLowerCase() === "active",
      );
    } else if (statusFilter === "inactive") {
      filtered = filtered.filter(
        (user) => user.status?.toLowerCase() === "inactive",
      );
    }

    // Apply role filter
    if (roleFilter !== "overall") {
      filtered = filtered.filter(
        (user) => user.role?.toLowerCase() === roleFilter.replace("-", " "),
      );
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm, statusFilter, roleFilter]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, roleFilter]);

  useEffect(() => {
    if (!canManageTotp) {
      setTotpResetRequests({});
      return;
    }

    let cancelled = false;

    async function fetchTotpResetRequests() {
      try {
        const listRequests = httpsCallable(
          functions,
          "listTotpResetRequestsHttp",
        );
        const result = await listRequests();
        if (cancelled) return;

        const requestMap = {};
        (result.data?.requests || []).forEach((request) => {
          if (request.uid) requestMap[request.uid] = request;
        });
        setTotpResetRequests(requestMap);
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error("Error fetching TOTP reset requests:", err);
        }
        if (!cancelled) setTotpResetRequests({});
      }
    }

    fetchTotpResetRequests();

    return () => {
      cancelled = true;
    };
  }, [canManageTotp]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        actionMenuRef.current &&
        !actionMenuRef.current.contains(event.target)
      ) {
        setOpenActionUserId(null);
      }
      if (
        filterDropdownRef.current &&
        !filterDropdownRef.current.contains(event.target)
      ) {
        setFilterDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleRoleFilterChange = (filter) => {
    setRoleFilter(filter);
  };

  const handleChangeRoleClick = (
    userId,
    currentRole,
    currentPosition,
    currentDepartment,
  ) => {
    const currentUser = users.find((u) => u.id === userId) || {};
    const normalizedRole = String(currentRole || "").toLowerCase();
    setEditingRoleUserId(userId);
    setSelectedRole(
      isRoleAllowedForAccount(currentUser, normalizedRole) ? normalizedRole : "",
    );
    setSelectedPosition(currentPosition || "");
    setSelectedDepartment(currentDepartment || "");
  };

  const handleRoleChange = async (userId) => {
    if (!selectedRole) return;

    const currentUser = users.find((u) => u.id === userId) || {};
    if (!isRoleAllowedForAccount(currentUser, selectedRole)) {
      const accountType = isBlackboardAccount(currentUser)
        ? "Blackboard"
        : "Non-Blackboard";
      const allowedRoles = getAssignableRoleOptions(currentUser)
        .map(({ label }) => label)
        .join(" or ");
      showToast(`${accountType} accounts can only be assigned to ${allowedRoles}.`);
      return;
    }

    // Check if position is required but not selected
    if (
      (selectedRole === "faculty" || selectedRole === "admin") &&
      !selectedPosition
    ) {
      showToast("Please select a position for this account level.");
      return;
    }
    // Check if department is required but not selected (faculty only)
    if (selectedRole === "faculty" && !selectedDepartment) {
      showToast("Please select a department for the faculty account level.");
      return;
    }

    try {
      const userRef = doc(db, "users", userId);
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
          levelprogress: currentUser.levelprogress || 0,
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
          levelProgress: deleteField(),
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
          levelProgress: deleteField(),
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
          levelProgress: deleteField(),
        };
      }

      await updateDoc(userRef, updateData);

      logAudit({
        action: "ROLE_CHANGED",
        category: "account",
        actorName: actorData?.name || "",
        details: {
          targetUserId: userId,
          targetUserName: currentUser.name || "",
          targetUserEmail: currentUser.email || "",
          previousRole: currentUser.role || "",
          newRole: selectedRole,
          newPosition: selectedPosition || "",
          newDepartment: selectedDepartment || "",
        },
      });

      // Update local state
      setUsers(
        users.map((user) => {
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
              levelprogress: user.levelprogress || 0,
            };
          } else if (selectedRole === "faculty") {
            updatedUser = {
              ...updatedUser,
              position: selectedPosition,
              department: selectedDepartment,
            };
            delete updatedUser.skills;
            delete updatedUser.eventHistory;
            delete updatedUser.interests;
            delete updatedUser.level;
            delete updatedUser.levelprogress;
          } else if (selectedRole === "admin") {
            updatedUser = {
              ...updatedUser,
              position: selectedPosition,
            };
            delete updatedUser.department;
            delete updatedUser.skills;
            delete updatedUser.eventHistory;
            delete updatedUser.interests;
            delete updatedUser.level;
            delete updatedUser.levelprogress;
          } else {
            updatedUser = {
              ...updatedUser,
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
        }),
      );

      setEditingRoleUserId(null);
      setSelectedRole("");
      setSelectedPosition("");
      setSelectedDepartment("");
    } catch (err) {
      console.error("Error updating role:", err);
      showToast("Failed to update account level. Please try again.");
    }
  };

  const handleCancelRoleChange = () => {
    setEditingRoleUserId(null);
    setSelectedRole("");
    setSelectedPosition("");
    setSelectedDepartment("");
  };

  const handleResetTotp = async (targetUser) => {
    if (!canManageTotp || !canResetTotpForUser(targetUser)) return;

    const targetLabel = targetUser.email || targetUser.name || "this user";
    const confirmed = await showConfirm(
      `Reset TOTP setup for ${targetLabel}? The user will need to enroll a new authenticator QR on next login.`,
    );

    if (!confirmed) return;

    setOpenActionUserId(null);
    setTotpActionUserId(targetUser.id);

    try {
      const resetTotp = httpsCallable(functions, "resetUserTotpHttp");
      await resetTotp({ targetUid: targetUser.id });

      setTotpResetRequests((current) => {
        const next = { ...current };
        delete next[targetUser.id];
        return next;
      });

      showToast(
        "TOTP setup reset. The user can enroll a new QR on next login.",
      );
    } catch (err) {
      if (import.meta.env.DEV) console.error("Error resetting TOTP:", err);
      showToast(err?.message || "Failed to reset TOTP setup.", "error");
    } finally {
      setTotpActionUserId(null);
    }
  };

  const formatCreatedAt = (createdAt) => {
    if (!createdAt) return "N/A";
    const dateValue = createdAt.toDate ? createdAt.toDate() : createdAt;
    if (!(dateValue instanceof Date) || Number.isNaN(dateValue.getTime())) {
      return "N/A";
    }
    return dateValue.toLocaleDateString();
  };

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  return (
    <div className="roster-page">
      {/* Header */}
        <div className="roster-header">
          <h1 className="roster-title">Roster Account Management</h1>
        </div>

        {/* Search and Role Filters */}
        <div className="search-filter-row">
          {/* Search Bar */}
          <div className="search-wrapper">
            <input
              type="text"
              placeholder="Search email, name, username, account level..."
              aria-label="Search roster accounts"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            {searchTerm && (
              <button
                type="button"
                className="search-clear-btn"
                aria-label="Clear roster search"
                onClick={() => setSearchTerm("")}
              >
                &times;
              </button>
            )}
            <svg
              className="search-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          {/* Role Filters */}
          <div className="role-filters">
            {/* Mobile custom dropdown */}
            <div className="role-filter-dropdown" ref={filterDropdownRef}>
              <button
                type="button"
                className="role-filter-dropdown-trigger"
                aria-expanded={filterDropdownOpen}
                aria-haspopup="listbox"
                onClick={() => setFilterDropdownOpen((o) => !o)}
              >
                {ROLE_FILTER_OPTIONS.find((o) => o.value === roleFilter)?.label ?? "All"}
                <svg
                  className={`role-filter-chevron${filterDropdownOpen ? " open" : ""}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {filterDropdownOpen && (
                <div className="role-filter-dropdown-menu" role="listbox">
                  {ROLE_FILTER_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      role="option"
                      aria-selected={roleFilter === value}
                      className={`role-filter-dropdown-item${roleFilter === value ? " active" : ""}`}
                      onClick={() => {
                        handleRoleFilterChange(value);
                        setFilterDropdownOpen(false);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Desktop pills */}
            {ROLE_FILTER_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={`role-filter-pill${roleFilter === value ? " active" : ""}`}
                onClick={() => handleRoleFilterChange(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <hr className="roster-divider" />

        {/* Table */}
        <div className="table-container">
          {loading ? (
            <div className="loading-message">Loading users...</div>
          ) : (
            <table className="roster-table">
              <thead>
                <tr>
                  <th className="text-left"> </th>
                  <th className="text-left">Full Name</th>
                  <th className="text-left">Email</th>
                  <th className="text-center">Account Level</th>
                  <th className="text-center">Account Created</th>
                  {canManageTotp && (
                    <th className="text-center">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={canManageTotp ? 6 : 5}
                      className="no-users-message"
                    >
                      No users found
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((user, index) => (
                    <tr key={user.id}>
                      <td className="row-number">
                        {(currentPage - 1) * pageSize + index + 1}
                      </td>
                      <td className="user-full-name">
                        {getUserFullName(user)}
                      </td>
                      <td className="user-name">
                        <div className="user-email-stack">
                          <span>{user.email || "N/A"}</span>
                          {canManageTotp && totpResetRequests[user.id] && (
                            <span className="totp-request-badge">
                              TOTP reset requested
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-center role-cell">
                        {!readOnly && editingRoleUserId === user.id ? (
                          <div className="role-edit-container">
                            <select
                              value={selectedRole}
                              onChange={(e) => {
                                setSelectedRole(e.target.value);
                                setSelectedPosition("");
                                setSelectedDepartment("");
                              }}
                              className="role-select"
                            >
                              {!isRoleAllowedForAccount(user, selectedRole) && (
                                <option value="">Select Account Level</option>
                              )}
                              {getAssignableRoleOptions(user).map(({ value, label }) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>

                            {(selectedRole === "faculty" ||
                              selectedRole === "admin") && (
                                <select
                                  value={selectedPosition}
                                  onChange={(e) =>
                                    setSelectedPosition(e.target.value)
                                  }
                                  className="role-select"
                                >
                                  <option value="">Select Position</option>
                                  {positionsByRole[selectedRole]?.map(
                                    (position) => (
                                      <option key={position} value={position}>
                                        {position}
                                      </option>
                                    ),
                                  )}
                                </select>
                              )}

                            {selectedRole === "faculty" && (
                              <select
                                value={selectedDepartment}
                                onChange={(e) =>
                                  setSelectedDepartment(e.target.value)
                                }
                                className="role-select"
                              >
                                <option value="">Select Department</option>
                                {departments.map((dept) => (
                                  <option key={dept} value={dept}>
                                    {dept}
                                  </option>
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
                            {!readOnly && (
                              <button
                                onClick={() =>
                                  handleChangeRoleClick(
                                    user.id,
                                    user.role,
                                    user.position,
                                    user.department,
                                  )
                                }
                                className="change-role-btn"
                              >
                                <img src={ChangeIcon} alt="Change Account Level" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="text-center account-created-cell">
                        {formatCreatedAt(user.createdAt)}
                      </td>
                      {canManageTotp && (
                        <td className="text-center roster-actions-cell">
                          <div
                            className="roster-row-actions"
                            ref={
                              openActionUserId === user.id ?
                                actionMenuRef :
                                null
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Escape") {
                                setOpenActionUserId(null);
                              }
                            }}
                          >
                            <button
                              type="button"
                              className="roster-action-trigger"
                              aria-label={`Actions for ${
                                user.email || user.name || "user"
                              }`}
                              aria-expanded={openActionUserId === user.id}
                              aria-haspopup="menu"
                              onClick={() =>
                                setOpenActionUserId((current) =>
                                  current === user.id ? null : user.id,
                                )
                              }
                            >
                              <MoreVertIcon fontSize="small" />
                            </button>

                            {openActionUserId === user.id && (
                              <div className="roster-action-menu" role="menu">
                                {canResetTotpForUser(user) ? (
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="roster-action-menu-item"
                                    disabled={totpActionUserId === user.id}
                                    onClick={() => handleResetTotp(user)}
                                  >
                                    {totpActionUserId === user.id ?
                                      "Resetting..." :
                                      "Reset TOTP setup"}
                                  </button>
                                ) : (
                                  <span className="roster-action-menu-empty">
                                    No actions available
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
        {filteredUsers.length > pageSize && (
          <div className="pagination-controls">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              className="pagination-btn"
              disabled={currentPage === 1}
            >
              Prev
            </button>
            <span className="pagination-status">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() =>
                setCurrentPage((page) => Math.min(totalPages, page + 1))
              }
              className="pagination-btn"
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        )}
    </div>
  );
}
