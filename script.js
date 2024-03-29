const verdicts = [{
  full: "WRONG_ANSWER",
  short: "WA",
}, {
  full: "TIME_LIMIT_EXCEEDED",
  short: "TLE",
}, {
  full: "COMPILATION_ERROR",
  short: "CE",
}, {
  full: "RUNTIME_ERROR",
  short: "RE",
}, {
  full: "CHALLENGED / HACKED",
  short: "CHL",
}, {
  full: "MEMORY_LIMIT_EXCEEDED",
  short: "MLE",
}, {
  full: "SKIPPED",
  short: "IGNORED",
}];

const localize = [{
  "en": {
    searchHandleButton: "Search unsolved tasks",
    showTagsChexBox: " Show problem's tags",
    counterOfProblems: `😱 Count of problems: `,
    nameTD: "Name ",
    tagsTD: "Tags",
    ratingTD: "Rating",
    lastTD: "Last Verdict / Submit Link",
    congratsText: "Congratulations, You haven't got any unsolved tasks! 🥳",
    errorText: ":( Error 4xx: Perhaps this handle does not exist",
    aboutButton: "About",
    aboutProject: "More about the Project",
  },
  "ru": {
    searchHandleButton: "Поиск нерешённых задач",
    showTagsChexBox: " Показывать теги задач",
    counterOfProblems: `😱 Количество задач: `,
    nameTD: "Название ",
    tagsTD: "Теги",
    ratingTD: "Рейтинг",
    lastTD: "Последний вердикт / Последняя отправка",
    congratsText: "Поздравляю, У тебя нет нерешённых задач! 🥳",
    errorText: ":( Ошибка 4xx: Возможно данного хендла не существует",
    aboutButton: "О проекте",
    aboutProject: "Подробнее о проекте",
  },
}];

let url = new URL(window.location.href).searchParams.get("lang");
let lang = (!localStorage.lang && !url)
  ? "en"
  : (url == "en" || url == "ru")
  ? url
  : (url)
  ? "en"
  : localStorage.lang;

const onloadFunction = (lang) => {
  localStorage.lang = lang;
  document.getElementById("handle").value = (localStorage.handle != undefined)
    ? localStorage.handle
    : "";
  //document.getElementById("start").innerHTML = localize[0][lang].searchHandleButton
  document.getElementById("doNotShowTags-label").innerHTML =
    localize[0][lang].showTagsChexBox;
  document.getElementById("about").innerHTML = localize[0][lang].aboutButton;
  document.getElementById("nameTD").innerHTML = localize[0][lang].nameTD;
  document.getElementById("ratingTD").innerHTML = localize[0][lang].ratingTD;
  document.getElementById("lastTD").innerHTML = localize[0][lang].lastTD;
  document.getElementById("tagsTD").innerHTML = localize[0][lang].tagsTD;
};

document.addEventListener("DOMContentLoaded", () => {
  onloadFunction(lang);
  document.getElementById("start").click();
});

const reduction = (verdict) => {
  for (let i of verdicts) {
    if (i.full.includes(verdict)) return [i.short, i.full];
  }
  return [verdict, verdict];
};

const startButton = document.getElementById("handle");
startButton.addEventListener("keyup", (event) => {
  if (event.key === "Enter") {
    document.getElementById("start").click();
  }
});

start.onclick = async () => {
  document.getElementById("nameTD").innerHTML = localize[0][lang].nameTD;
  document.getElementById("tagsTD").hidden = true;
  document.getElementById("table-main").hidden = true;
  document.getElementById("counter").hidden = false;
  document.getElementById("table-list").innerHTML = "";
  const handle = document.getElementById("handle").value;
  if (handle == "") {
    document.getElementById("counter").hidden = true;
    return -1;
  }
  localStorage.handle = handle;
  document.getElementById("counter").innerHTML = "Loading...";
  document.getElementById("start").disabled = true;
  document.getElementById("doNotShowTags").disabled = true;
  console.log(`Ok, handle is "${handle}"`);
  const res = await fetch(
    `https://codeforces.com/api/user.status?handle=${handle}&lang=${lang}`,
  );
  if (!res.ok) {
    let error = localize[0][lang].errorText;
    localStorage.handle = "";
    console.log(error);
    document.getElementById("counter").innerHTML = error;
  } else {
    console.log("Yeah, CodeForces is working! ^_^");
    let submition = await res.json();
    submition = submition.result;
    let allBadSubmissions = {},
      listOfUnsolved = {},
      unsolvedTasks = [];
    console.log(`Finding ${handle}'s unsolved tasks...`);
    for (const item of submition) {
      if (item.verdict === "OK") {
        allBadSubmissions[
          item.problem.contestId + item.problem.index
        ] = item;
      }
    }
    for (const item of submition) {
      if (
        allBadSubmissions[
          item.problem.contestId + item.problem.index
        ] == null
      ) {
        if (
          !listOfUnsolved[
            item.problem.contestId + item.problem.index
          ]
        ) {
          listOfUnsolved[
            item.problem.contestId + item.problem.index
          ] = item;
        }
      }
    }
    allBadSubmissions = "";
    for (const i in listOfUnsolved) unsolvedTasks.push(listOfUnsolved[i]);
    listOfUnsolved = "";
    console.log("Sorting problems by rating...");
    unsolvedTasks.sort((q, w) => {
      const a = (q.problem.rating == undefined) ? 10e5 : q.problem.rating,
        b = (w.problem.rating == undefined) ? 10e5 : w.problem.rating;
      return a - b;
    });
    document.getElementById("table-list").innerHTML = "";
    if (!unsolvedTasks.length) {
      document.getElementById("counter").hidden = false;
      document.getElementById("counter").innerHTML =
        localize[0][lang].congratsText;
      console.log("You haven't got any unsolved tasks :)");
    } else {
      console.log(unsolvedTasks);
      document.getElementById("table-main").hidden = false;
      document.getElementById("counter").innerHTML = `${
        localize[0][lang].counterOfProblems
      } ${unsolvedTasks.length}`;
      for (let i in unsolvedTasks) {
        let linkToTask = (+unsolvedTasks[i].problem.contestId >= 100000)
            ? `https://codeforces.com/problemset/gymProblem/${
              unsolvedTasks[i].problem.contestId
            }/${unsolvedTasks[i].problem.index}`
            : `https://codeforces.com/contest/${
              unsolvedTasks[i].problem.contestId
            }/problem/${unsolvedTasks[i].problem.index}`,
          slash = `${unsolvedTasks[i].problem.contestId}|${
            unsolvedTasks[i].problem.index
          }`,
          linkToLastSubmit = `https://codeforces.com/contest/${
            unsolvedTasks[i].problem.contestId
          }/submission/${unsolvedTasks[i].id}`;
        let add = `
                <tr style = "border-bottom: solid 1px white;">
                    <td><a href="${linkToTask}" target="_blank">${slash}</a></td>
                    <td><a href="${linkToTask}" target="_blank" id="problemName">${
          unsolvedTasks[i].problem.name
        }</a></td>
                `;
        if (document.getElementById("doNotShowTags").checked) {
          add += `<td>${
            (unsolvedTasks[i].problem.tags.length)
              ? unsolvedTasks[i].problem.tags.join(", ")
              : "-"
          }</td>`;
        }
        add += `
                    <td title="Rating">${
          (unsolvedTasks[i].problem.rating == undefined)
            ? "-"
            : unsolvedTasks[i].problem.rating
        }</td>
                    <td title="${reduction(unsolvedTasks[i].verdict)[1]}">${
          reduction(unsolvedTasks[i].verdict)[0]
        }</td>
                    <td><a href="${linkToLastSubmit}" target="_blank">${
          unsolvedTasks[i].id
        }</a></td>
                </tr>
            `;
        document.getElementById("table-list").innerHTML += add;
      }
    }
  }
  if ((document.getElementById("doNotShowTags").checked)) {
    document.getElementById("tagsTD").hidden = false;
  }
  document.getElementById("start").disabled = false;
  document.getElementById("doNotShowTags").disabled = false;
  document.getElementById("nameTD").innerHTML +=
    '<input type="text" id="searchTask" placeholder="Search...">';
  console.log("We did it!!");
  searchTasks();
};

about.onclick = async function () {
  document.getElementById("table-main").hidden = true;
  document.getElementById("counter").hidden = true;
  if (document.getElementById("table-list").innerHTML.includes("sadykhzadeh")) {
    document.getElementById("table-list").innerHTML = "";
    return 0;
  }
  document.getElementById("table-list").innerHTML = `
        </br>
        <a href="https://codeforces.com/blog/entry/79960?locale=${lang}" target="_blank">${
    localize[0][lang].aboutProject
  }</a>
        </a><h6><a href="https://github.com/sadykhzadeh/unsolved-cf-problems" target="_blank">Github</a> |
        <a href="https://github.com/sadykhzadeh" target="_blank">Azer Sadykhzadeh</a></h6>
    `;
};

let searchTasks = () => {
  try {
    let name = document.getElementById("searchTask");
    name.addEventListener("keyup", () => {
      let whatWeSearch = name.value.toLowerCase(),
        taskList = document.querySelectorAll("#table-list tr");
      taskList.forEach((elem) => {
        if (
          elem.querySelectorAll("#problemName")[0].innerHTML.toLowerCase()
            .indexOf(whatWeSearch) > -1
        ) {
          elem.style.display = "";
        } else {
          elem.style.display = "none";
        }
      });
    });
  } catch {
  }
};
searchTasks();
