/** The app icon: a card with a chip on the brand blue, drawn so no image file is needed. */
export function AppIconArt({ size }: { size: number }) {
  const u = size / 100;
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #4f6ef7, #2a3fb8)",
      }}
    >
      <div
        style={{
          width: 64 * u,
          height: 42 * u,
          borderRadius: 7 * u,
          background: "linear-gradient(135deg, #f6d98a, #c4902f)",
          boxShadow: `0 ${3 * u}px ${8 * u}px rgba(0,0,0,.25)`,
          display: "flex",
          padding: 8 * u,
        }}
      >
        <div
          style={{ width: 14 * u, height: 10 * u, borderRadius: 2 * u, background: "#e9edf2" }}
        />
      </div>
    </div>
  );
}
