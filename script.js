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

let startButton = document.getElementById("handle");
startButton.addEventListener("keyup", (event) => {
    if (event.keyCode === 13) {
        document.getElementById("start").click();
    }
});

start.onclick = async function() {
    document.getElementById("table-main").hidden = true
    document.getElementById("counter").hidden = false
    document.getElementById("table-list").innerHTML = ""
    const handle = document.getElementById('handle').value
    if (handle == "") {
        document.getElementById("counter").hidden = true
        return -1
    }
    document.getElementById("counter").innerHTML = "Loading..."
    document.getElementById("start").disabled = true
    document.getElementById("doNotShowTags").disabled = true
    console.log(`Ok, handle is "${handle}"`)
    const res = await fetch(`https://codeforces.com/api/user.status?handle=${handle}&lang=en`)
    if (!res.ok) {
        let error = ":( Error 4xx: Perhaps this handle does not exist"
        console.log(error)
        document.getElementById("counter").innerHTML = error
    } else {
        console.log("Yeah, CodeForces is working! ^_^")
        let submition = await res.json()
        submition = submition.result
        let allNotOkSumbitions = {},
            ArrOfunsolvedTasks = {},
            unsolvedTasks = [];
        console.log(`Finding ${handle}'s unsolved tasks...`)
        for (let i in submition) {
            if (submition[i].verdict === 'OK') {
                allNotOkSumbitions[submition[i].problem.contestId + submition[i].problem.index] = submition[i]
            }
        }
        for (let i in submition) {
            if (allNotOkSumbitions[submition[i].problem.contestId + submition[i].problem.index] == null) {
                if (!ArrOfunsolvedTasks[submition[i].problem.contestId + submition[i].problem.index])
                    ArrOfunsolvedTasks[submition[i].problem.contestId + submition[i].problem.index] = submition[i]
            }
        }
        allNotOkSumbitions = ""
        for (let i in ArrOfunsolvedTasks) unsolvedTasks.push(ArrOfunsolvedTasks[i])
        ArrOfunsolvedTasks = ""
        console.log("Sorting problems by rating...")
        unsolvedTasks.sort((q, w) => {
            let a = (q.problem.rating == undefined) ? 10e5 : q.problem.rating,
                b = (w.problem.rating == undefined) ? 10e5 : w.problem.rating
            return a - b
        })
        document.getElementById("table-list").innerHTML = ""
        if (!unsolvedTasks.length) {
            document.getElementById("counter").hidden = false
            document.getElementById("counter").innerHTML = "Congratulations, You haven't got any unsolved tasks! 🥳"
            console.log("You haven't got any unsolved tasks")
        } else {
            console.log(unsolvedTasks)
            document.getElementById("table-main").hidden = false
            document.getElementById("counter").innerHTML = `${handle} has got ${unsolvedTasks.length} unsolved problems! 😱`
            for (let i in unsolvedTasks) {
                let linkToTask = (+unsolvedTasks[i].problem.contestId >= 100000) ? `https://codeforces.com/problemset/gymProblem/${unsolvedTasks[i].problem.contestId}/${unsolvedTasks[i].problem.index}` : `https://codeforces.com/contest/${unsolvedTasks[i].problem.contestId}/problem/${unsolvedTasks[i].problem.index}`,
                    slash = `${unsolvedTasks[i].problem.contestId}|${unsolvedTasks[i].problem.index}`,
                    linkToLastSubmit = `https://codeforces.com/contest/${unsolvedTasks[i].problem.contestId}/submission/${unsolvedTasks[i].id}`
                document.getElementById('table-list').innerHTML += `
                <tr style = "border-bottom: solid 1px white;">
                    <td><a href="${linkToTask}" target="_blank">${slash}</a></td>
                    <td><a href="${linkToTask}" target="_blank" id="problemName">${unsolvedTasks[i].problem.name}</a></td>
                    <td>${(!document.getElementById('doNotShowTags').checked) ? "We don't show tags 🙈" : (unsolvedTasks[i].problem.tags.length) ? unsolvedTasks[i].problem.tags.join(", "): '-'}</td>
                    <td title="Rating">${(unsolvedTasks[i].problem.rating == undefined) ? '-' : unsolvedTasks[i].problem.rating}</td>
                    <td title="${reduction(unsolvedTasks[i].verdict)[1]}">${reduction(unsolvedTasks[i].verdict)[0]}</td>
                    <td><a href="${linkToLastSubmit}" target="_blank">${unsolvedTasks[i].id}</a></td>
                </tr>
            `
            }
        }
    }
    document.getElementById("start").disabled = false
    document.getElementById("doNotShowTags").disabled = false
    console.log("We did it!!")
}

about.onclick = async function() {
    document.getElementById("table-main").hidden = true
    document.getElementById("counter").hidden = true
    if (document.getElementById("table-list").innerHTML.includes("sadykhzadeh")) {
        document.getElementById("table-list").innerHTML = ""
        return 0
    }
    document.getElementById("table-list").innerHTML = `
        </br>
        <a href="https://github.com/sadykhzadeh/unsolved-cf-problems/stargazers"style="margin-right:1%;"><img alt="GitHub stars" src="https://img.shields.io/github/stars/sadykhzadeh/unsolved-cf-problems?color=darkgreen&style=flat-square"></a><a href="https://github.com/sadykhzadeh/unsolved-cf-problems/issues"><img alt="GitHub issues" src="https://img.shields.io/github/issues/sadykhzadeh/unsolved-cf-problems?color=blue&style=flat-square"></a><h3><a href="https://github.com/sadykhzadeh/unsolved-cf-problems" target="_blank">Project's Github</a> |
        by Azer Sadykhzadeh [<a href="https://github.com/sadykhzadeh" target="_blank">Github</a>]</h3>
    `
}

let searchTasks = () => {
    let name = document.getElementById('searchTask')
    name.addEventListener('keyup', () => {
        let whatWeSearch = name.value.toLowerCase(),
            taskList = document.querySelectorAll('#table-list tr');
        taskList.forEach(elem => {
            let namee = elem.querySelectorAll('#problemName')[0]
            if (namee.innerHTML.toLowerCase().indexOf(whatWeSearch) > -1) {
                elem.style.display = '';
            } else {
                elem.style.display = 'none';
            }
        })
    });
}
searchTasks();