
//page dedicated for admin, containing left collapsible panel, and outlet for main content. 
import { useState, useEffect } from "react";
import { Outlet, NavLink } from "react-router-dom";
import { auth, db } from "../../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import Header from "../../components/Header";
import "../../styles/admin.css";
import Sidebar from "../../components/Sidebar"
import { adminLinks } from "../../hooks/sidebarConfig";

export default function AdminLayout() {
    const [collapsed, setCollapsed] = useState(false);
    const [userProfile, setUserProfile] = useState(null);

    //for profile
    useEffect(() => {
        const fetchUserProfile = async () => {
            const currentUser = auth.currentUser;
            if (!currentUser) return;

            try {
                const userRef = doc(db, "users", currentUser.uid);
                const userSnap = await getDoc(userRef);

                if (!userSnap.exists()) return;

                const data = userSnap.data();

                //specify what data of user you want to retrieve
                setUserProfile({
                    name: data.name,
                    role: data.role,
                    avatar: data.avatar
                });
            } catch (error) {
                console.error("Error fetching user profile:", error);
            }
        };

        fetchUserProfile();
    }, []);

    return (
        <div className="admin-page">
            <Header />
            <Sidebar
                links={adminLinks}
                collapsed={collapsed}
                setCollapsed={setCollapsed}
                userProfile={userProfile}
            />
            {/* ONLY THIS PART CHANGES */}
            <main className="admin-main">
                <Outlet />
            </main>
        </div>
    );
}
