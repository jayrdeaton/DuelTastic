import { TurfBoard, type TurfBoardProps } from './TurfBoard'

// Native has Skia ready before any JS runs, so the board renders on the first frame. Web has to load
// CanvasKit first: see TurfBoardHost.web.tsx, and @tastic/hud's README, "Skia on web".
export default function TurfBoardHost(props: TurfBoardProps) {
  return <TurfBoard {...props} />
}
