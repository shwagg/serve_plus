import React from 'react';
import { useParams } from 'react-router-dom';
// If you want to make this dynamic, you can fetch from Firestore here as well

const missionCards = [
  {
    id: "laguna-lake-cleanup",
    img: '/assets/mission1.jpg',
    alt: 'Laguna Lake Cleanup',
    title: 'Laguna Lake Watershed Reforestation & River Cleanup Drive',
    description: `This initiative is dedicated to the environmental health of Laguna Lake by mobilizing volunteers for essential river cleanup and waste segregation along its tributaries. Following the cleanup, participants engage in reforestation, planting native seedlings to stabilize riverbanks, prevent erosion, and enhance water quality. This project directly contributes to the long-term ecological resilience of the region, ensuring a healthier future for Laguna's communities and its vital water source.`,
    details: [
      'Volunteers conduct a simultaneous cleanup along a designated stretch of the river, segregating collected waste.',
      'Planting indigenous tree seedlings along the riverbanks to prevent soil erosion and improve water quality.',
      'Waste segregation, data collection, and seedling planting/maintenance.'
    ]
  },
  // Add more missions here as needed
];

export default function EventDetails() {
  const { id } = useParams();
  const mission = missionCards.find(m => m.id === id) || missionCards[0];

  return (
    <div style={{ padding: 32 }}>
      <div style={{ maxWidth: 900, margin: '0 auto', background: '#fff', borderRadius: 20, boxShadow: '0 2px 16px #0002' }}>
        <img src={mission.img} alt={mission.alt} style={{ width: '100%', height: 220, objectFit: 'cover', borderTopLeftRadius: 20, borderTopRightRadius: 20 }} />
        <div style={{ padding: 32 }}>
          <h2 style={{ color: '#234e7b', fontWeight: 700, marginBottom: 16 }}>
            {mission.title}
          </h2>
          <p style={{ color: '#234e7b', fontSize: 16, marginBottom: 24 }}>
            {mission.description}
          </p>
          <div style={{ marginBottom: 24 }}>
            <strong>Activity Details:</strong>
            <ul style={{ color: '#234e7b', fontSize: 15, marginTop: 8 }}>
              {mission.details.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
          <button
            style={{ background: '#7bb661', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 32px', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}
            onClick={() => window.location.href = `/event/${mission.id}/activity`}
          >
            JOIN EVENT
          </button>
        </div>
      </div>
    </div>
  );
}
