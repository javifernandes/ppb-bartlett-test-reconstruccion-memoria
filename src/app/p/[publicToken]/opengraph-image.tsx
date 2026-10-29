import { ImageResponse } from "next/og";

export const alt = "Bartlett Memory Experiment";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const MemoryMark = () => (
  <div
    style={{
      width: 152,
      height: 152,
      borderRadius: 38,
      background: "#12b886",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 24px 70px rgba(18, 184, 134, 0.28)",
      position: "relative",
    }}
  >
    <div
      style={{
        color: "white",
        fontSize: 82,
        fontWeight: 800,
        lineHeight: 1,
        display: "flex",
      }}
    >
      B
    </div>
    <div
      style={{
        position: "absolute",
        right: 20,
        top: 23,
        width: 13,
        height: 13,
        borderRadius: 99,
        background: "rgba(255,255,255,0.95)",
        display: "flex",
      }}
    />
    <div
      style={{
        position: "absolute",
        right: 17,
        top: 49,
        width: 9,
        height: 9,
        borderRadius: 99,
        background: "rgba(255,255,255,0.7)",
        display: "flex",
      }}
    />
    <div
      style={{
        position: "absolute",
        right: 19,
        top: 70,
        width: 6,
        height: 6,
        borderRadius: 99,
        background: "rgba(255,255,255,0.45)",
        display: "flex",
      }}
    />
  </div>
);

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "#171918",
        color: "#f1f3f5",
        padding: "72px 82px",
        alignItems: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 520,
          height: 520,
          borderRadius: 999,
          right: -130,
          top: -180,
          border: "2px solid rgba(18, 184, 134, 0.20)",
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 360,
          height: 360,
          borderRadius: 999,
          right: -50,
          top: -100,
          border: "2px solid rgba(18, 184, 134, 0.30)",
          display: "flex",
        }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 54 }}>
        <MemoryMark />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            maxWidth: 800,
          }}
        >
          <div
            style={{
              color: "#63e6be",
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: 3,
              textTransform: "uppercase",
              display: "flex",
              marginBottom: 22,
            }}
          >
            Psychology · Memory
          </div>
          <div
            style={{
              fontSize: 67,
              fontWeight: 780,
              lineHeight: 1.05,
              letterSpacing: -2.5,
              display: "flex",
            }}
          >
            Bartlett Memory Experiment
          </div>
          <div
            style={{
              color: "#adb5bd",
              fontSize: 29,
              lineHeight: 1.35,
              marginTop: 25,
              display: "flex",
            }}
          >
            Read a story · Complete a brief activity · Reconstruct it from
            memory
          </div>
          <div
            style={{
              color: "#dee2e6",
              fontSize: 23,
              marginTop: 34,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 99,
                background: "#12b886",
                display: "flex",
              }}
            />
            About 5 minutes · Anonymous · Desktop &amp; mobile
          </div>
        </div>
      </div>
    </div>,
    size,
  );
}
