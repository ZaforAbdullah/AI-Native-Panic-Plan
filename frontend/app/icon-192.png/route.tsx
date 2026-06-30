import { ImageResponse } from "next/og";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 192,
          height: 192,
          background: "#0d0f1a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 38,
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
    { width: 192, height: 192 }
  );
}
