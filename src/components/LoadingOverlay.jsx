import loadingGif from "../assets/loading.gif";

export default function LoadingOverlay() {
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backdropFilter: "blur(5px)",
      WebkitBackdropFilter: "blur(5px)",
      backgroundColor: "rgba(255, 255, 255, 0.35)",
    }}>
      <img
        src={loadingGif}
        alt="Loading..."
        style={{ width: 350, height: "auto" }}
      />
    </div>
  );
}
