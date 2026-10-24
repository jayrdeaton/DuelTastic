import { TagBoard, type TagBoardProps } from './TagBoard'

// Native has Skia ready before any JS runs, so the board renders on the first frame. Web has to load
// CanvasKit first: see TagBoardHost.web.tsx, and @tastic/hud's README, "Skia on web".
export default function TagBoardHost(props: TagBoardProps) {
  return <TagBoard {...props} />
}
