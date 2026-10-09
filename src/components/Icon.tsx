/** Rounded line icons, one weight throughout (DESIGN §8.8). 24×24, stroke 1.75. */
import Svg, { Circle, Path } from 'react-native-svg';

type Shape = { d: string } | { cx: number; cy: number; r: number; fill?: boolean };

const SHAPES = {
  home: [{ d: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' }],
  wallet: [
    { d: 'M3 7a2 2 0 0 1 2-2h12a1 1 0 0 1 1 1v2' },
    { d: 'M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z' },
    { cx: 16, cy: 14, r: 1.2, fill: true },
  ],
  plus: [{ d: 'M12 5v14M5 12h14' }],
  list: [{ d: 'M8 6h13M8 12h13M8 18h13' }, { cx: 3.5, cy: 6, r: 0.8, fill: true }, { cx: 3.5, cy: 12, r: 0.8, fill: true }, { cx: 3.5, cy: 18, r: 0.8, fill: true }],
  dots: [{ cx: 5, cy: 12, r: 1.4, fill: true }, { cx: 12, cy: 12, r: 1.4, fill: true }, { cx: 19, cy: 12, r: 1.4, fill: true }],
  arrowDown: [{ d: 'M12 5v14M5 12l7 7 7-7' }],
  arrowUp: [{ d: 'M12 19V5M5 12l7-7 7 7' }],
  swap: [{ d: 'M7 7h13M16 3l4 4-4 4M17 17H4M8 13l-4 4 4 4' }],
  clock: [{ cx: 12, cy: 12, r: 9 }, { d: 'M12 7v5l3 2' }],
  chevronLeft: [{ d: 'M15 18l-6-6 6-6' }],
  chevronRight: [{ d: 'M9 18l6-6-6-6' }],
  close: [{ d: 'M6 6l12 12M18 6L6 18' }],
  check: [{ d: 'M5 12l5 5 9-10' }],
  card: [{ d: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }, { d: 'M3 10h18M7 15h3' }],
  receipt: [{ d: 'M6 3h12v18l-3-2-3 2-3-2-3 2z' }, { d: 'M9 8h6M9 12h6' }],
  shield: [{ d: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z' }, { d: 'M9 12l2 2 4-4' }],
  sliders: [{ d: 'M4 7h9M17 7h3M4 17h3M11 17h9' }, { cx: 15, cy: 7, r: 2 }, { cx: 9, cy: 17, r: 2 }],
  repeat: [{ d: 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3' }],
  bell: [{ d: 'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0' }],
  trend: [{ d: 'M3 17l6-6 4 4 8-8M15 7h6v6' }],
  alert: [{ d: 'M12 3l10 18H2z' }, { d: 'M12 10v5M12 18.2v.01' }],
  info: [{ cx: 12, cy: 12, r: 9 }, { d: 'M12 11v6M12 7.5v.01' }],
  download: [{ d: 'M12 4v11M7 11l5 5 5-5M5 20h14' }],
  upload: [{ d: 'M12 16V5M7 9l5-5 5 5M5 20h14' }],
  trash: [{ d: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13' }],
  edit: [{ d: 'M4 20h4L19 9l-4-4L4 16z' }],
  lock: [{ d: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3' }],
  calendar: [{ d: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4' }],
} satisfies Record<string, Shape[]>;

export type IconName = keyof typeof SHAPES;

interface Props {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 24, color, strokeWidth = 1.75 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {(SHAPES[name] as Shape[]).map((shape, index) =>
        'd' in shape ? (
          <Path key={index} d={shape.d} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <Circle key={index} cx={shape.cx} cy={shape.cy} r={shape.r} stroke={color} strokeWidth={strokeWidth} fill={shape.fill ? color : 'none'} />
        ),
      )}
    </Svg>
  );
}
