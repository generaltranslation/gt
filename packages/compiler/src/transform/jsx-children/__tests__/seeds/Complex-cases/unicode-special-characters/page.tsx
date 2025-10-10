import { T, Branch } from "gt-next";
export default function Home() {
  return (
    <T>
      <Branch
        branch="language"
        english="Hello 👋 World"
        chinese="你好世界"
        arabic="مرحبا بالعالم"
        emoji="🚀 🌟 ✨ 💫 ⭐"
        symbols="© ® ™ € £ ¥ § ¶ † ‡"
        math="∞ ≠ ≤ ≥ ± ∓ × ÷ √"
      />
    </T>
  );
}