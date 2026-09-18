import {
  AbsoluteFill,
  Composition,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  type CalculateMetadataFunction,
} from "remotion";

type Scene = "intro" | "dashboard" | "content" | "campaign" | "norway" | "close";

const sceneForFrame = (frame: number): Scene => {
  if (frame < 150) return "intro";
  if (frame < 840) return "dashboard";
  if (frame < 1500) return "content";
  if (frame < 2190) return "campaign";
  if (frame < 2550) return "norway";
  return "close";
};

const sceneStart = (scene: Scene) => ({ intro: 0, dashboard: 150, content: 840, campaign: 1500, norway: 2190, close: 2550 })[scene];
const ease = Easing.bezier(0.16, 1, 0.3, 1);

const Panel: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ background: "#151515", border: "1px solid #2b2b2b", borderRadius: 18, ...style }}>{children}</div>
);

const Badge: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = "#f4b51c" }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color, background: `${color}18`, border: `1px solid ${color}45`, borderRadius: 999, padding: "8px 13px", fontSize: 15, fontWeight: 800 }}>
    <span style={{ width: 7, height: 7, borderRadius: 99, background: color }} />{children}
  </span>
);

const Animated: React.FC<{ from: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ from, children, style }) => {
  const frame = useCurrentFrame();
  return <div style={{ opacity: interpolate(frame, [from, from + 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease }), translate: `${interpolate(frame, [from, from + 18], [24, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease })}px 0`, ...style }}>{children}</div>;
};

const ChatShell: React.FC<{ prompt: string; widgetName: string; scene: Scene }> = ({ prompt, widgetName, scene }) => {
  const frame = useCurrentFrame();
  const local = frame - sceneStart(scene);
  const typed = prompt.slice(0, Math.max(0, Math.floor((local - 28) * 1.55)));
  return <Panel style={{ width: 354, height: 570, padding: 22, display: "flex", flexDirection: "column" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#ffffff", fontWeight: 800, fontSize: 18 }}><span style={{ width: 24, height: 24, display: "inline-block", borderRadius: 8, background: "#ffffff", color: "#090909", textAlign: "center", lineHeight: "24px" }}>C</span>ChatGPT</div>
    <div style={{ marginTop: 26, color: "#797979", fontSize: 14, fontWeight: 800 }}>NEW CHAT</div>
    <div style={{ marginTop: 14, color: "#d6d1c8", fontSize: 16, lineHeight: 1.45 }}>Plan my next release</div>
    <div style={{ marginTop: "auto" }}><div style={{ color: "#a4a19c", fontSize: 13, marginBottom: 10 }}>Artist request</div>
      <div style={{ background: "#252525", borderRadius: 15, padding: "15px 16px", minHeight: 99, color: "#f2f0ec", fontSize: 16, lineHeight: 1.35 }}>{typed}{local > 28 && local < 260 ? <span style={{ color: "#f4b51c" }}>|</span> : null}</div>
      <div style={{ marginTop: 14, color: "#9b9b9b", fontSize: 13 }}>Using Music Release Manager</div><div style={{ marginTop: 8, color: "#f4b51c", fontWeight: 800, fontSize: 14 }}>{local > 270 ? `${widgetName} ready` : "Preparing workspace..."}</div>
    </div>
  </Panel>;
};

const Dashboard: React.FC = () => <Panel style={{ padding: 30, height: 570, flex: 1, borderColor: "#4b3a10", background: "#11110f" }}>
  <Badge>RELEASE DASHBOARD</Badge>
  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, alignItems: "flex-end" }}><div><h2 style={{ fontSize: 36, margin: 0, color: "#fbf7ee" }}>Times Up</h2><div style={{ color: "#b6b1a7", marginTop: 7, fontSize: 17 }}>Single • Release date 22 Jan 2027</div></div><Badge color="#76c893">Promotion</Badge></div>
  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 26 }}>{[["Current stage", "Promotion"], ["Next move", "Build social calendar"], ["Planning state", "No actions published"]].map(([label, value]) => <div key={label} style={{ padding: 16, background: "#1d1d19", borderRadius: 12 }}><div style={{ color: "#a8a396", fontSize: 13, fontWeight: 800 }}>{label}</div><div style={{ color: "#f7f2e8", marginTop: 7, fontSize: 16, fontWeight: 800 }}>{value}</div></div>)}</div>
  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 9, marginTop: 28 }}>{["Foundation", "Distribution", "Profiles", "Listener path", "Content", "Press", "Release day"].map((phase, index) => <div key={phase}><div style={{ height: 8, borderRadius: 99, background: index < 4 ? "#f4b51c" : "#3b3b35" }} /><div style={{ color: index === 3 ? "#f4b51c" : "#aaa59b", fontSize: 11, lineHeight: 1.2, marginTop: 9, fontWeight: 800 }}>{phase}</div></div>)}</div>
  <div style={{ marginTop: 28, padding: "17px 18px", background: "#211c0d", borderRadius: 13, border: "1px solid #5b4916", color: "#e9ddb1", fontSize: 16 }}>Next action: prepare press kit, verify live links and capture learnings after release.</div>
</Panel>;

const ContentStudio: React.FC = () => <Panel style={{ padding: 30, height: 570, flex: 1, borderColor: "#463a1b", background: "#12110e" }}>
  <Badge>ARTIST CONTENT STUDIO</Badge><h2 style={{ fontSize: 35, margin: "20px 0 6px", color: "#fbf7ee" }}>Release content pack</h2><div style={{ color: "#b6b1a7", fontSize: 17 }}>Times Up • Norwegian draft</div>
  <div style={{ display: "grid", gridTemplateColumns: "1.15fr .85fr", gap: 16, marginTop: 22 }}><div style={{ display: "grid", gap: 12 }}>{[["Release description", "Times Up is a new single by Elvic Kongolo. Confirm final details before use."], ["Instagram", "Times Up kommer snart. Lagre datoen og følg med for mer."], ["TikTok idea", "Første lytt: nærbilde, refreng og releasedato."]].map(([label, copy]) => <div key={label} style={{ padding: 14, background: "#1d1c18", borderRadius: 12 }}><div style={{ display: "flex", justifyContent: "space-between", color: "#f4b51c", fontWeight: 800, fontSize: 13 }}><span>{label}</span><span>Copy</span></div><div style={{ color: "#eee9df", fontSize: 15, lineHeight: 1.35, marginTop: 8 }}>{copy}</div></div>)}</div>
    <div style={{ background: "#201c0f", border: "1px solid #5c4a16", borderRadius: 14, padding: 18 }}><div style={{ color: "#f4b51c", fontSize: 13, fontWeight: 800 }}>IMAGE BRIEF</div><div style={{ color: "#f8f5ed", fontSize: 18, fontWeight: 800, marginTop: 12 }}>Vertical cover teaser</div><div style={{ color: "#c6c0b4", fontSize: 14, lineHeight: 1.45, marginTop: 12 }}>Rights-cleared gold and black record-inspired teaser with space for title.</div><div style={{ borderTop: "1px solid #5d512a", marginTop: 20, paddingTop: 15, color: "#ebdfaf", fontSize: 14, lineHeight: 1.5 }}>Confirm facts, credits, rights and links before use.</div></div></div>
</Panel>;

const CampaignStudio: React.FC = () => <Panel style={{ padding: 30, height: 570, flex: 1, borderColor: "#1e605b", background: "#0e1716" }}>
  <Badge color="#55d2bb">CAMPAIGN STUDIO</Badge><div style={{ display: "flex", justifyContent: "space-between", marginTop: 22 }}><div><h2 style={{ fontSize: 35, margin: 0, color: "#f3f8f5" }}>Times Up pre-save</h2><div style={{ color: "#aebfba", marginTop: 7, fontSize: 17 }}>ChatGPT Ads planning brief • Norwegian</div></div><Badge color="#8bd5c6">Planning only</Badge></div>
  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginTop: 25 }}>{[["Goal", "Pre-saves"], ["Audience", "Norway 18-34"], ["Creative", "2 drafts"], ["Budget", "NOK 3,000"], ["Approval", "3 checks"]].map(([label, value]) => <div key={label} style={{ padding: 13, background: "#152421", borderRadius: 11 }}><div style={{ color: "#87afa7", fontSize: 12, fontWeight: 800 }}>{label}</div><div style={{ color: "#edf7f3", fontSize: 14, fontWeight: 800, marginTop: 7 }}>{value}</div></div>)}</div>
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 18 }}><div style={{ background: "#14201e", borderRadius: 12, padding: 16 }}><div style={{ color: "#61cbb8", fontWeight: 800, fontSize: 13 }}>AD COPY</div><div style={{ color: "#f1f8f4", fontSize: 18, fontWeight: 800, marginTop: 10 }}>Times Up is coming</div><div style={{ color: "#b8c9c4", fontSize: 14, marginTop: 9 }}>Pre-save Elvic Kongolo&apos;s new single and be ready on release day.</div></div><div style={{ background: "#14201e", borderRadius: 12, padding: 16 }}><div style={{ color: "#61cbb8", fontWeight: 800, fontSize: 13 }}>APPROVAL CHECKS</div><div style={{ color: "#dcece6", fontSize: 14, marginTop: 9, lineHeight: 1.6 }}>✓ Destination and copy<br />✓ Budget and payment separately<br />✓ Final launch action separately</div></div></div>
  <div style={{ marginTop: 17, padding: "14px 16px", background: "#16322c", border: "1px solid #2e8979", borderRadius: 12, color: "#b7eee2", fontSize: 15, fontWeight: 700 }}>No ad account accessed. No payment added. No campaign purchased or launched.</div>
</Panel>;

const NorwaySupport: React.FC = () => <Panel style={{ padding: 30, height: 570, flex: 1, borderColor: "#32446a", background: "#111521" }}>
  <Badge color="#8ea7e9">NORWAY ARTIST SUPPORT</Badge><h2 style={{ fontSize: 35, margin: "22px 0 5px", color: "#f2f5ff" }}>Funding plan for a songwriter</h2><div style={{ color: "#b7c0d9", fontSize: 17 }}>Trondheim • Preparing a release</div>
  <div style={{ display: "grid", gap: 12, marginTop: 25 }}>{[["1", "Clarify the project scope", "Separate the writing, recording, release and promotion costs before applying."], ["2", "Check official starting points", "Review relevant funding bodies and municipal cultural support with current criteria."], ["3", "Build a realistic timeline", "Map deadlines, required documents and capacity alongside the release plan."]].map(([number, title, copy]) => <div key={number} style={{ display: "flex", gap: 16, padding: 15, borderRadius: 12, background: "#182037" }}><div style={{ color: "#a7b9ef", fontWeight: 900, fontSize: 19 }}>{number}</div><div><div style={{ color: "#eff3ff", fontSize: 17, fontWeight: 800 }}>{title}</div><div style={{ color: "#c0c8dc", fontSize: 14, marginTop: 5 }}>{copy}</div></div></div>)}</div>
  <div style={{ marginTop: 18, color: "#b9c7ef", fontSize: 14 }}>Current deadlines and eligibility must be confirmed with official sources.</div>
</Panel>;

const Demo: React.FC = () => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const scene = sceneForFrame(frame); const local = frame - sceneStart(scene); const progress = interpolate(frame, [0, 2700], [0, 100], { extrapolateRight: "clamp" }); const sceneOpacity = interpolate(local, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease }); const introExit = interpolate(frame, [115, 150], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  if (scene === "intro") return <AbsoluteFill style={{ background: "#090909", color: "#f8f4ec", fontFamily: "Arial, Helvetica, sans-serif", justifyContent: "center", alignItems: "center" }}><div style={{ opacity: introExit, textAlign: "center", width: 840 }}><Img src={staticFile("release-manager-logo.png")} style={{ width: 170, height: 170, objectFit: "contain", borderRadius: 28, background: "#f7f3ea" }} /><div style={{ color: "#f4b51c", marginTop: 30, fontSize: 17, fontWeight: 900, letterSpacing: 2 }}>MUSIC RELEASE MANAGER</div><h1 style={{ fontSize: 66, margin: "16px 0 12px", lineHeight: 1.04 }}>Plan. Release. Promote. Grow.</h1><div style={{ color: "#beb8ae", fontSize: 25, lineHeight: 1.4 }}>A product walkthrough for artists and music teams.</div></div></AbsoluteFill>;
  const content = { dashboard: { prompt: "Plan Times Up for 22 January. Master and cover are ready; distribution is next.", name: "Release Dashboard", widget: <Dashboard /> }, content: { prompt: "Create a Norwegian content pack for Times Up: bio, pitch, captions, video ideas and image prompts.", name: "Artist Content Studio", widget: <ContentStudio /> }, campaign: { prompt: "Create a Norwegian pre-save campaign brief for Times Up, NOK 3,000 over 14 days in Oslo, Bergen and Trondheim.", name: "Campaign Studio", widget: <CampaignStudio /> }, norway: { prompt: "I am a songwriter in Trondheim preparing a release and need help with funding. What should I do first?", name: "Norway Artist Support", widget: <NorwaySupport /> } } as const;
  if (scene === "close") return <AbsoluteFill style={{ background: "#090909", color: "#f8f4ec", fontFamily: "Arial, Helvetica, sans-serif", justifyContent: "center", alignItems: "center" }}><div style={{ textAlign: "center", opacity: sceneOpacity }}><Badge>READY FOR ARTISTS</Badge><h1 style={{ fontSize: 68, margin: "22px 0 12px" }}>Music Release Manager</h1><div style={{ fontSize: 27, color: "#c6c0b5" }}>Plan releases. Create content. Prepare campaigns responsibly.</div><div style={{ marginTop: 38, color: "#f4b51c", fontSize: 19, fontWeight: 800 }}>No publishing, payment or ad launch happens without separate approval.</div></div></AbsoluteFill>;
  const active = content[scene];
  return <AbsoluteFill style={{ background: "#090909", color: "#f8f4ec", fontFamily: "Arial, Helvetica, sans-serif", padding: "42px 54px" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: 44 }}><div style={{ color: "#f4b51c", fontWeight: 900, letterSpacing: 1.4, fontSize: 17 }}>MUSIC RELEASE MANAGER</div><div style={{ color: "#aaa59a", fontSize: 15 }}>Product walkthrough • Planning tools for artists</div></div><div style={{ marginTop: 30, display: "flex", gap: 22, opacity: sceneOpacity }}><ChatShell prompt={active.prompt} widgetName={active.name} scene={scene} /><Animated from={260} style={{ flex: 1 }}>{active.widget}</Animated></div><div style={{ position: "absolute", left: 54, right: 54, bottom: 34 }}><div style={{ height: 4, borderRadius: 99, background: "#292929" }}><div style={{ height: 4, width: `${progress}%`, borderRadius: 99, background: "#f4b51c" }} /></div><div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, color: "#85817b", fontSize: 13, fontWeight: 800 }}><span>{active.name}</span><span>{Math.ceil((2700 - frame) / fps)}s</span></div></div></AbsoluteFill>;
};

const calculateMetadata: CalculateMetadataFunction<Record<string, unknown>> = () => ({});

export const MusicReleaseManagerDemo: React.FC = () => <Composition id="MusicReleaseManagerDemo" component={Demo} durationInFrames={2700} fps={30} width={1280} height={720} calculateMetadata={calculateMetadata} />;
