const TRAIT_COPY = "copy";
const TRAIT_MOVE = "move";

export const Traits = {
    "i32": TRAIT_COPY,
    "f64": TRAIT_COPY,
    "bool": TRAIT_COPY,
    "String": TRAIT_MOVE
}

export const is_movable = (type) => 
    Traits[type] === TRAIT_MOVE;

export const is_copyable = (type) =>
    Traits[type] === TRAIT_COPY;