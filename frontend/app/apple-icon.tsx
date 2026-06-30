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
          background: "#0d0f1a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 36,
        }}
      >
        <div
          style={{
            color: "#5b8eff",
            fontSize: 110,
            fontWeight: "bold",
            fontFamily: "system-ui, sans-serif",
            lineHeight: 1,
          }}
        >
          P
        </div>
      </div>
    ),
    size
  );
}
