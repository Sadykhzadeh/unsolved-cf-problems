import {
    verdicts
} from "./modules/verdicts.js"

const reduction = (verdict) => {
    for (let i of verdicts) {
        if (i.full.includes(verdict)) return [i.short, i.full]
    }
    return [verdict, verdict]
}

export { reduction }