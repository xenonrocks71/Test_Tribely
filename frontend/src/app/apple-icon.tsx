import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F3F4F6",
        }}
      >
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #5B4DFF 0%, #2F80ED 100%)",
          }}
        >
          <span
            style={{
              color: "white",
              fontSize: 72,
              fontWeight: 700,
              fontFamily: "system-ui, sans-serif",
            }}
          >
            T
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
