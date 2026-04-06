import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { auth, db } from "../../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import Header from "../../components/Header";
import "../../styles/admin.css";
import Sidebar from "../../components/Sidebar";
import { sysadminLinks } from "../../hooks/sidebarConfig";

export default function SysAdminLayout() {
    const [collapsed, setCollapsed] = useState(false);
    const [userProfile, setUserProfile] = useState(null);

    useEffect(() => {
        const fetchUserProfile = async () => {
            const currentUser = auth.currentUser;
            if (!currentUser) return;

            try {
                const userRef = doc(db, "users", currentUser.uid);
                const userSnap = await getDoc(userRef);

                if (!userSnap.exists()) return;

                const data = userSnap.data();
                setUserProfile({
                    name: data.name,
                    role: data.role,
                    avatar: data.avatar,
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
                links={sysadminLinks}
                roleLabel="System Admin"
                collapsed={collapsed}
                setCollapsed={setCollapsed}
                userProfile={userProfile}
            />
            <main className="admin-main">
                <Outlet />
            </main>
        </div>
    );
}
