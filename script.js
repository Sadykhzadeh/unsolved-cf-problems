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
    }
]

const reduction = (verdict) => {
    for (let i of verdicts) {
        if (i.full.includes(verdict)) return [i.short, i.full]
    }
    return [verdict, verdict]
}

start.onclick = async function() {
    const handle = document.getElementById('handle').value
    if (handle == "") {
        return -1
    }
    console.log(`Ok, handle is ${handle}`)
    const res = await fetch(`https://codeforces.com/api/user.status?handle=${handle}`)
    if (res.ok) {
        let submition = await res.json();
        submition = submition.result;
        let allNotOkSumbitions = {},
            ArrOfunsolvedTasks = {},
            unsolvedTasks = [];
        for (let i in submition) {
            if (submition[i].verdict === 'OK') {
                allNotOkSumbitions[submition[i].problem.contestId + submition[i].problem.index] = submition[i];
            }
        }
        for (let i in submition) {
            if (allNotOkSumbitions[submition[i].problem.contestId + submition[i].problem.index] == null) {
                if (!ArrOfunsolvedTasks[submition[i].problem.contestId + submition[i].problem.index])
                    ArrOfunsolvedTasks[submition[i].problem.contestId + submition[i].problem.index] = submition[i];
            }
        }
        delete allNotOkSumbitions
        for (let i in ArrOfunsolvedTasks) unsolvedTasks.push(ArrOfunsolvedTasks[i]);
        delete ArrOfunsolvedTasks
        unsolvedTasks.sort((q, w) => {
            let a = (q.problem.rating == undefined) ? 10e7 : q.problem.rating,
                b = (w.problem.rating == undefined) ? 10e7 : w.problem.rating
            return a - b;
        })
        for (let i in unsolvedTasks) {
            let linkToTask = `https://codeforces.com/contest/${unsolvedTasks[i].problem.contestId}/problem/${unsolvedTasks[i].problem.index}`,
                slash = `${unsolvedTasks[i].problem.contestId}/${unsolvedTasks[i].problem.index}`,
                linkToLastSubmit = `https://codeforces.com/contest/${unsolvedTasks[i].problem.contestId}/submission/${unsolvedTasks[i].id}`
            document.getElementById('table-list').innerHTML += `
                <tr style = "color: white;">
                    <td><a href="${linkToTask}" target="_blank">${slash}</a></td>
                    <td><a href="${linkToTask}" target="_blank">${unsolvedTasks[i].problem.name}</a></td>
                    <td>${(unsolvedTasks[i].problem.tags.length) ? unsolvedTasks[i].problem.tags.join(", "): '-'}</td>
                    <td>${(unsolvedTasks[i].problem.rating == undefined) ? '-' : unsolvedTasks[i].problem.rating}</td>
                    <td title="${reduction(unsolvedTasks[i].verdict)[1]}">${reduction(unsolvedTasks[i].verdict)[0]} (<a href="${linkToLastSubmit}" target="_blank">?</a>)</td>
                </tr>
            `
        }
    }
}