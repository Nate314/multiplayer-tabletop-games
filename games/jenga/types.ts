export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];
export type Pose = { p: Vec3; q: Quat };

// level is where the block was placed, kept even after it falls
export type Block = { id: number; level: number; pose: Pose; v?: Vec3; w?: Vec3 };

// anchor is block-local; target is world, at the anchor's height
export type Grab = { block: number; anchor: Vec3; target: Vec3 };
