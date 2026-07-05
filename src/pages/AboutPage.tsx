export default function AboutPage() {
  return (
    <div className="about-page">
      <div className="page-title">DoppelCast</div>
      <p style={{ color: "var(--text-secondary)" }}>App version 1.0.0</p>
      <p style={{ color: "var(--text-secondary)" }}>Android screen recorder.</p>
      <p style={{ color: "var(--text-secondary)" }}>
        Developed by <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>0xramm</span>
      </p>
      <a href="https://github.com/0xramm/DoppelCast" target="_blank" rel="noreferrer">
        github.com/0xramm/DoppelCast
      </a>
      <p style={{ color: "var(--text-muted)", fontSize: 9 }}>Issues and contributions welcome on the repo above.</p>
    </div>
  );
}
