import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #5B4DFF 0%, #2F80ED 100%)",
          borderRadius: 8,
        }}
      >
        <span
          style={{
            color: "white",
            fontSize: 18,
            fontWeight: 700,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          T
        </span>
      </div>
    ),
    { ...size },
  );
}
