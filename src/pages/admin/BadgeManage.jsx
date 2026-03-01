import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import "../../styles/Badge.css";

export default function BadgeDisplay({ userId }) {
    const [badges, setBadges] = useState([]);

    useEffect(() => {
        const fetchBadges = async () => {
            const snap = await getDocs(
                collection(db, "users", userId, "badges")
            );
            const data = snap.docs.map(doc => doc.data());
            setBadges(data);
        };

        fetchBadges();
    }, [userId]);

    return (
        <div className="badge-container">
            {badges.map((badge, idx) => (
                <div key={idx} className={`badge-circle badge-${badge.category}`}>
                    <div className="badge-inner">
                        {badge.nameSnapshot}
                    </div>
                </div>
            ))}
        </div>
    );
}