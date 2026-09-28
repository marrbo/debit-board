// components/PageHeader/HeaderActions.tsx
"use client";

import {
  forwardRef,
  type ReactNode,
  type ButtonHTMLAttributes,
  type MouseEvent,
} from "react";
import Link from "next/link";
import { usePermissions } from "@/hooks/usePermissions";
import type { Role } from "@/lib/permissions";

export type HeaderActionColor =
  | "brand"
  | "info"
  | "success"
  | "warning"
  | "orange"
  | "error";

/**
 * Classe Tailwind para colorir o ícone **apenas no hover**.
 * Em repouso o ícone fica neutro (`text-heading/70`).
 */
const HOVER_CLASS: Record<HeaderActionColor, string> = {
  brand: "group-hover:text-brand",
  info: "group-hover:text-info",
  success: "group-hover:text-success",
  warning: "group-hover:text-warning",
  orange: "group-hover:text-orange-400",
  error: "group-hover:text-red-500",
};

interface CommonProps {
  children: ReactNode;
  tooltip: string;
  color?: HeaderActionColor;
  badge?: ReactNode;
  isActive?: boolean;
  className?: string;
  /**
   * Papéis exigidos. `undefined` ou `[]` → sempre visível.
   * Se o usuário não tem nenhum dos papéis, o botão **não é
   * renderizado** (não é só desabilitado — evita pistas visuais
   * de ações que o usuário não pode executar).
   */
  requiredRoles?: Role[];
}

/**
 * Props específicas do `<button>`.
 *
 * `HTMLAttributes` declara `color` (legado HTML), então omitimos antes
 * de estender. `target` / `rel` já não existem em `ButtonHTMLAttributes`
 * — são de `AnchorHTMLAttributes` — então não precisam ser omitidos.
 */
type ButtonBaseProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className" | "children" | "onClick" | "type" | "color"
>;

interface LinkVariantProps extends CommonProps {
  href: string;
  target?: string;
  rel?: string;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
}

/**
 * ⚠️ Sem `href` — é isso que faz o union ser discriminado por `"href" in props`.
 * Declarar `href?: never` aqui **não** funciona: `in` só estreita quando a
 * chave existe em apenas um dos membros.
 */
interface ButtonVariantProps extends CommonProps, ButtonBaseProps {
  // nada
}

type Props = LinkVariantProps | ButtonVariantProps;

function buildIcon(
  children: ReactNode,
  color: HeaderActionColor,
  badge: ReactNode | undefined,
) {
  return (
    <>
      <span
        className={`inline-flex items-center justify-center [&>svg]:w-4 [&>svg]:h-4 text-heading/70 transition-colors ${HOVER_CLASS[color]}`}
      >
        {children}
      </span>
      {badge}
    </>
  );
}

function buildTooltip(tooltip: string, isActive: boolean) {
  return (
    <span
      role="tooltip"
      aria-hidden="true"
      className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 rounded-md bg-elevated border border-default text-[11px] text-heading whitespace-nowrap shadow-md transition-opacity duration-150 pointer-events-none z-50 ${
        isActive ? "opacity-0" : "opacity-0 group-hover:opacity-100"
      }`}
    >
      {tooltip}
    </span>
  );
}

/**
 * Botão de ação do header: ícone puro, `btn-ghost`, tooltip custom
 * abaixo do ícone.
 *
 * O tooltip é mais rápido e visualmente consistente com o template do
 * que o `title` nativo (que demora ~1s e usa o estilo do SO). O ícone
 * fica neutro em repouso e ganha a cor configurada apenas durante o
 * hover — a barra permanece discreta mesmo com 6+ botões.
 *
 * Aceita `href` (renderiza `<Link>`) ou `onClick` (renderiza
 * `<button>`). O `ref` é encaminhado ao `<button>` — útil para ancorar
 * popovers.
 */
const HeaderActions = forwardRef<HTMLButtonElement, Props>(
  function HeaderActions(props, ref) {
    const { canAccess } = usePermissions();

    // Hook não pode ser condicional — chamado antes do early return.
    if (!canAccess(props.requiredRoles)) {
      return null;
    }

    // ----------------------------------------------------------
    // Ramo Link — discriminado por `"href" in props`
    // ----------------------------------------------------------
    if ("href" in props) {
      const {
        href,
        target,
        rel,
        onClick,
        children,
        tooltip,
        color = "brand",
        badge,
        isActive = false,
        className = "",
      } = props;

      return (
        <div className={`relative group ${className}`}>
          <Link
            href={href}
            target={target}
            rel={rel}
            onClick={onClick}
            aria-label={tooltip}
            className="btn-ghost aspect-square !rounded-full relative"
          >
            {buildIcon(children, color, badge)}
          </Link>
          {buildTooltip(tooltip, isActive)}
        </div>
      );
    }

    // ----------------------------------------------------------
    // Ramo Button — aqui `props` já é `ButtonVariantProps`
    // ----------------------------------------------------------
    const {
      children,
      tooltip,
      color = "brand",
      badge,
      isActive = false,
      className = "",
      ...buttonProps
    } = props;

    return (
      <div className={`relative group ${className}`}>
        <button
          ref={ref}
          type="button"
          aria-label={tooltip}
          {...buttonProps}
          className="btn-ghost aspect-square !rounded-full relative"
        >
          {buildIcon(children, color, badge)}
        </button>
        {buildTooltip(tooltip, isActive)}
      </div>
    );
  },
);

export default HeaderActions;
