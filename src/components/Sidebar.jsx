import { useState } from "react";
import { NavLink } from "react-router-dom";
//import { ViewSidebarOutlinedIcon } from "./icons/index.js";
import { adminLinks } from "../hooks/sidebarConfig";

export default function Sidebar({ userProfile }) {
    //palitan ito to default
    const [activeCategory, setActiveCategory] = useState("system");

    const current = adminLinks.find(
        (c) => c.key === activeCategory
    );

    return (
        <section className="admin-strip">
            <div className="admin-strip-inner">
                {/* LEFT SECTION */}
                <div className="sidebar-left">
                    <div className="sidebar-user">
                        <div className="sidebar-avatar" />
                        <div className="sidebar-user-info">
                            <span className="sidebar-user-name">
                                {userProfile?.name}
                            </span>
                            <span className="sidebar-breadcrumb">
                                {current?.label}
                            </span>
                        </div>
                    </div>

                    <button className="sidebar-back">←</button>
                </div>

                {/* RIGHT SECTION */}
                <div className="sidebar-right">
                    <div className="sidebar-categories">
                        {adminLinks.map((cat) => (
                            <button
                                key={cat.key}
                                className={`sidebar-category ${activeCategory === cat.key ? "active" : ""
                                    }`}
                                onClick={() => setActiveCategory(cat.key)}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>

                    {activeCategory && (
                        <div className="sidebar-ribbon">
                            {adminLinks
                                .find(cat => cat.key === activeCategory)
                                ?.children?.map(sub => (
                                    <NavLink
                                        key={sub.to}
                                        to={sub.to}
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
            </div>
        </section >
    );
}