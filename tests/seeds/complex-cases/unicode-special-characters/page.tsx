import { T, Select } from "gt-next";
export default function Home() {
  return (
    <T>
      <Select
        value="language"
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