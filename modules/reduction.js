const verdicts = [{
        full: "WRONG_ANSWER",
        short: "WA"
    },
    {
        full: "TIME_LIMIT_EXCEEDED",
        short: "TLE"
    },
    {
        full: "COMPILATION_ERROR",
        short: "CE"
    },
    {
        full: "RUNTIME_ERROR",
        short: "RE"
    },
    {
        full: "CHALLENGED / HACKED",
        short: "CHL"
    },
    {
        full: "MEMORY_LIMIT_EXCEEDED",
        short: "MLE"
    },
    {
        full: "SKIPPED",
        short: "IGNORED"
    }
]

const reduction = (verdict) => {
    for (let i of verdicts) {
        if (i.full.includes(verdict)) return [i.short, i.full]
    }
    return [verdict, verdict]
}

export { reduction }