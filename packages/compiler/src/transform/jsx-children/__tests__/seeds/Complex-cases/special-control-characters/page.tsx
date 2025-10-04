import { T, Plural, Branch } from "gt-next";
export default function Home() {
  return (
    <T>
    <Plural
      n={1}
      singular="Line1\nLine2\tTabbed"
      plural="Special: !@#$%^&*()_+-=[]{}|;:,.<>?"
      other={`Template with \${variable} and \`backticks\``}
    />

<Branch
          branch="language"
          english="Hello World"
          spanish="Hola Mundo ñáéíóú"
          chinese="你好世界"
          emoji="🌍🌎🌏 Hello 👋"
          arabic="مرحبا بالعالم"
          russian="Привет мир"
        /> 
        <Plural
          n={1}
          singular={`simple template`}
          plural={`another simple template`}
        />
        <Branch
          branch="format"
          single={`single line`}
          multi={`
            line 1
            line 2
            line 3
          `}
        />   </T>
  );
}