const TRAIT_COPY = "copy";
const TRAIT_DROP = "move";

export const Traits = {
    "i32": TRAIT_COPY,
    "bool": TRAIT_COPY,
    "String": TRAIT_DROP
}

export const has_move_trait = (type) =>
    Traits[type] === TRAIT_DROP;

export const has_copy_trait = (type) =>
    Traits[type] === TRAIT_COPY;
