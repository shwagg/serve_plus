import { useState, useEffect, useRef } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
//import { ViewSidebarOutlinedIcon } from "./icons/index.js";
import { adminLinks } from "../hooks/sidebarConfig";

export default function Sidebar({ userProfile }) {
    const [activeCategory, setActiveCategory] = useState(null);
    const stripRef = useRef(null);
    const sidebarRef = useRef(null);
    const categoryRefs = useRef({});
    const [ribbonStyle, setRibbonStyle] = useState({});
    const location = useLocation();
    const navigate = useNavigate();
    const missionTitle = location.state?.missionTitle;

    useEffect(() => {
        const btn = categoryRefs.current[activeCategory];
        const strip = stripRef.current;
        if (!btn || !strip) return;

        const btnRect = btn.getBoundingClientRect();
        const stripRect = strip.getBoundingClientRect();

        const centerX =
            btnRect.left - stripRect.left + btnRect.width / 2;

        setRibbonStyle({
            left: centerX,
            transform: "translateX(-50%)",
            minWidth: btnRect.width,
        })
    }, [activeCategory]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (
                sidebarRef.current &&
                !sidebarRef.current.contains(event.target)
            ) {
                setActiveCategory(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const breadcrumb = (() => {
        const pathParts = location.pathname.split("/").filter(Boolean);

        if (pathParts[1] === "current-event") {
            return {
                parent: "Events",
                current: "Current Event",
                child: missionTitle || null
            };
        }

        for (const cat of adminLinks) {
            for (const child of cat.children || []) {
                if (location.pathname.startsWith(child.to)) {
                    return {
                        parent: cat.label,
                        current: child.label
                    };
                }
            }
        }

        return null;
    })();

    const handleSubItemClick = () => {
        setActiveCategory(null);
    };


    return (
        <section className="admin-strip" ref={sidebarRef}>
            <div className="admin-strip-inner" ref={stripRef}>
                {/* LEFT SECTION */}
                <div className="sidebar-left">
                    <div className="sidebar-user">
                        <div className="sidebar-avatar">
                            {userProfile?.avatar ? (
                                <img
                                    src={userProfile.avatar}
                                    alt="profile"
                                    className="sidebar-avatar-img"
                                />
                            ) : (
                                userProfile?.name?.charAt(0).toUpperCase()
                            )}
                        </div>

                        <div className="sidebar-user-info">
                            <span className="sidebar-user-name">
                                {userProfile?.name}
                            </span>
                            <span className="sidebar-user-role">
                                Admin
                            </span>
                        </div>
                    </div>

                </div>

                {/* RIGHT SECTION */}
                <div className="sidebar-right">
                    <div className="sidebar-categories">
                        {adminLinks.map((cat) => (
                            <button
                                key={cat.key}
                                ref={(el) => (categoryRefs.current[cat.key] = el)}
                                className={`sidebar-category ${activeCategory === cat.key ? "active" : ""}`}
                                onClick={() =>
                                    setActiveCategory(prev =>
                                        prev === cat.key ? null : cat.key
                                    )
                                }
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>
                {activeCategory && (
                    <div
                        className={`sidebar-ribbon ${activeCategory ? "show" : ""}`}
                        style={ribbonStyle}
                    >

                        {adminLinks
                            .find(cat => cat.key === activeCategory)
                            ?.children?.map(sub => (
                                <NavLink
                                    key={sub.to}
                                    to={sub.to}
                                    onClick={handleSubItemClick}
                                    className={({ isActive }) =>
                                        `sidebar-ribbon-item ${isActive ? "active" : ""}`
                                    }
                                >
                                    {sub.label}
                                </NavLink>
                            ))}
                    </div>
                )}
            </div>
            <div className="admin-context-strip">
                <button
                    className="context-back"
                    onClick={() => navigate(-1)}
                >
                    ← Back
                </button>

                {breadcrumb && (
                    <div className="context-breadcrumb">
                        <span>{breadcrumb.parent}</span>
                        <span className="sep">/</span>
                        <span>{breadcrumb.current}</span>
                        {breadcrumb.child && (
                            <>
                                <span className="sep">/</span>
                                <strong>{breadcrumb.child}</strong>
                            </>
                        )}
                    </div>
                )}
            </div>
        </section >
    );
}