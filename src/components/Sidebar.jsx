import { useState, useEffect, useRef } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { adminLinks } from "../hooks/sidebarConfig";

export default function Sidebar({ links, roleLabel }) {
    const resolvedLinks = links || adminLinks;
    const resolvedRoleLabel = roleLabel || "Admin";
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

        for (const cat of resolvedLinks) {
            for (const child of cat.children || []) {
                if (location.pathname.startsWith(child.to)) {
                    return {
                        parent: cat.label,
                        parentTo: cat.children?.[0]?.to || null,
                        current: child.label,
                        currentTo: child.to,
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
                {/* RIGHT SECTION */}
                <div className="sidebar-right">
                    <div className="sidebar-categories">
                        {resolvedLinks.map((cat) => (
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

                        {resolvedLinks
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
                        {breadcrumb.parentTo ? (
                            <button className="breadcrumb-link" onClick={() => navigate(breadcrumb.parentTo)}>
                                {breadcrumb.parent}
                            </button>
                        ) : (
                            <span>{breadcrumb.parent}</span>
                        )}
                        <span className="sep">/</span>
                        {breadcrumb.currentTo ? (
                            <button className="breadcrumb-link breadcrumb-current" onClick={() => navigate(breadcrumb.currentTo)}>
                                {breadcrumb.current}
                            </button>
                        ) : (
                            <span>{breadcrumb.current}</span>
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
        </section >
    );
}