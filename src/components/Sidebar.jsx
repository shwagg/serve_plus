import { useState, useEffect, useRef } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

export default function Sidebar({ links, collapsed, setCollapsed }) {
    const location = useLocation();
    const navigate = useNavigate();
    const missionTitle = location.state?.missionTitle;
    const resolvedLinks = links || [];
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClick(e) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    // Close dropdown on route change
    useEffect(() => {
        setDropdownOpen(false);
    }, [location.pathname]);

    const breadcrumb = (() => {
        const pathParts = location.pathname.split("/").filter(Boolean);

        if (pathParts[1] === "current-event") {
            const isDetail = !!pathParts[2];
            return {
                parent: "Events",
                parentKey: "events",
                current: "Current Event",
                currentTo: isDetail ? "/admin/current-event" : null,
                child: missionTitle || null,
            };
        }

        if (pathParts[1] === "projects" || pathParts[1] === "review-proposals") {
            const isDetail = pathParts[1] === "projects" && !!pathParts[2];
            return {
                parent: "Project",
                parentKey: "project",
                current: "Project Proposals",
                currentTo: isDetail ? "/admin/review-proposals" : null,
                child: isDetail && pathParts[3] === "tasks" ? "Manage Tasks" : null,
            };
        }

        for (const cat of resolvedLinks) {
            for (const child of cat.children || []) {
                if (location.pathname.startsWith(child.to)) {
                    return {
                        parent: cat.label,
                        parentKey: cat.key,
                        current: child.label,
                        currentTo: child.to,
                    };
                }
            }
        }

        return null;
    })();

    const activeCategory = breadcrumb
        ? resolvedLinks.find(c => c.key === breadcrumb.parentKey)
        : null;

    return (
        <>
            {/* Floating toggle button — slides between sidebar and strip */}
            <button
                className={`sidebar-toggle-btn sidebar-toggle-floating ${collapsed ? "collapsed" : ""}`}
                onClick={() => setCollapsed(prev => !prev)}
                aria-label="Toggle sidebar"
            >
                <span className="material-symbols-outlined">dock_to_right</span>
            </button>

            {/* Context strip: breadcrumbs only */}
            <div className="admin-context-strip">
                {breadcrumb && (
                    <div className="context-breadcrumb">
                        {/* Parent category — clickable, opens sub-item dropdown */}
                        <div className="breadcrumb-dropdown-wrapper" ref={dropdownRef}>
                            <button
                                className="breadcrumb-link"
                                onClick={() => setDropdownOpen(prev => !prev)}
                            >
                                {breadcrumb.parent}
                            </button>

                            {dropdownOpen && activeCategory && (
                                <div className="breadcrumb-dropdown">
                                    <p className="breadcrumb-dropdown-header">
                                        {activeCategory.label}
                                    </p>
                                    {activeCategory.children?.map(sub => {
                                        const isActive = location.pathname.startsWith(sub.to);
                                        return (
                                            <button
                                                key={sub.to}
                                                className={`breadcrumb-dropdown-item ${isActive ? "active" : ""}`}
                                                onClick={() => {
                                                    navigate(sub.to);
                                                    setDropdownOpen(false);
                                                }}
                                            >
                                                <span>{sub.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <span className="sep">/</span>

                        {/* Current page */}
                        {breadcrumb.currentTo ? (
                            <button
                                className="breadcrumb-link breadcrumb-current"
                                onClick={() => navigate(breadcrumb.currentTo)}
                            >
                                {breadcrumb.current}
                            </button>
                        ) : (
                            <span className="breadcrumb-current-plain">{breadcrumb.current}</span>
                        )}

                        {breadcrumb.child && (
                            <>
                                <span className="sep">/</span>
                                <strong>{breadcrumb.child}</strong>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Left sidebar panel */}
            <aside className={`admin-sidebar ${collapsed ? "collapsed" : ""}`}>
                <nav className="admin-sidebar-nav">
                    {resolvedLinks.map((cat) => (
                        <div key={cat.key} className="admin-sidebar-group">
                            <span className="admin-sidebar-group-label">{cat.label}</span>
                            {cat.children?.map((sub) => (
                                <NavLink
                                    key={sub.to}
                                    to={sub.to}
                                    className={({ isActive }) =>
                                        `admin-sidebar-item ${isActive ? "active" : ""}`
                                    }
                                >
                                    {sub.label}
                                </NavLink>
                            ))}
                        </div>
                    ))}
                </nav>
            </aside>
        </>
    );
}
