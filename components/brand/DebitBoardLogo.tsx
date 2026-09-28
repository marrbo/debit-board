// components/brand/DebitBoardLogo.tsx
//
// Logo do Debit-Board como componente SVG inline.
//
// API espelha o lucide-react: aceita `size` (número em px ou string
// CSS com unidade), propaga `className`, `style` e qualquer atributo
// de <svg> para o elemento raiz.
//
// Cores derivam dos tokens do tema (globals.css):
//   --brand-default      fundo (azul no light, azul claro no dark)
//   --brand-foreground   glifo "db" (branco no light, escuro no dark)
//
// Uso:
//   <DebitBoardLogo />                     // 64px, padrão
//   <DebitBoardLogo size={24} />           // 24px
//   <DebitBoardLogo size="2rem" />         // 2rem
//   <DebitBoardLogo className="opacity-80" />
//   <DebitBoardLogo aria-hidden />         // decorativo

import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & {
  /** Tamanho em px (number) ou qualquer unidade CSS (string). Padrão: 64. */
  size?: number | string;
};

export default function DebitBoardLogo({ size = 64, ...props }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label="Debit-Board"
      {...props}
    >
      <rect
        x="0"
        y="0"
        width="64"
        height="64"
        rx="14"
        ry="14"
        style={{ fill: "var(--button-primary-bg)" }}
      />
      <text
        x="32"
        y="43"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
        fontSize="32"
        fontWeight="700"
        textAnchor="middle"
        letterSpacing="-2"
        style={{ fill: "var(--brand-foreground)" }}
      >
        db
      </text>
    </svg>
  );
}
