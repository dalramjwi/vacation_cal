
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const VACATION_FILE = path.join(process.cwd(), 'vacation.json');

const getCommand = () => {
    const args = process.argv.slice(2);
    return args[0];
};

const init = () => {
    if (fs.existsSync(VACATION_FILE)) {
        console.log('이미 휴가 설정이 존재합니다.');
        return;
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('입사일을 입력해주세요 (YYYY-MM-DD): ', (joinDate) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(joinDate)) {
            console.log('날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식으로 입력해주세요.');
            rl.close();
            return;
        }

        const data = {
            join_date: joinDate,
            day_hours: 8,
            used_vacations: []
        };

        fs.writeFileSync(VACATION_FILE, JSON.stringify(data, null, 2));
        console.log(`휴가 설정이 완료되었습니다. 설정 파일: ${VACATION_FILE}`);
        rl.close();
    });
};

const add = () => {
    if (!fs.existsSync(VACATION_FILE)) {
        console.log('휴가 설정을 찾을 수 없습니다. "vacation init"을 먼저 실행해주세요.');
        return;
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('사용한 날짜를 입력해주세요 (YYYY-MM-DD): ', (date) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            console.log('날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식으로 입력해주세요.');
            rl.close();
            return;
        }

        rl.question('사용한 시간을 입력해주세요: ', (hoursStr) => {
            const hours = parseInt(hoursStr, 10);
            if (isNaN(hours) || hours <= 0) {
                console.log('시간이 올바르지 않습니다. 양수의 숫자를 입력해주세요.');
                rl.close();
                return;
            }

            const data = JSON.parse(fs.readFileSync(VACATION_FILE, 'utf8'));
            const { join_date, day_hours, used_vacations } = data;

            // --- 사용 가능한 휴가 시간 계산 (status 명령어 로직과 동일) ---
            const today = new Date();
            const joinDate = new Date(join_date);
            let passedMonths = (today.getFullYear() - joinDate.getFullYear()) * 12;
            passedMonths -= joinDate.getMonth();
            passedMonths += today.getMonth();
            if (today.getDate() < joinDate.getDate()) {
                passedMonths--;
            }
            passedMonths = Math.max(0, passedMonths);

            const firstAnniversary = new Date(joinDate);
            firstAnniversary.setFullYear(firstAnniversary.getFullYear() + 1);

            let generatedMonthlyDays = 0;
            if (today < firstAnniversary) {
                generatedMonthlyDays = passedMonths;
            } else {
                generatedMonthlyDays = 11;
            }
            generatedMonthlyDays = Math.min(11, generatedMonthlyDays);

            const generatedHours = generatedMonthlyDays * day_hours;
            const usedHours = used_vacations.reduce((sum, vac) => sum + vac.hours, 0);
            const remainingHours = generatedHours - usedHours;

            if (hours > remainingHours) {
                console.log(`❗ ${hours}시간을 사용할 수 없습니다. 남은 휴가 시간은 ${remainingHours}시간 입니다.`);
                rl.close();
                return;
            }

            data.used_vacations.push({ date, hours });
            fs.writeFileSync(VACATION_FILE, JSON.stringify(data, null, 2));
            console.log('휴가 사용이 기록되었습니다.');
            rl.close();
        });
    });
};

const status = () => {
    if (!fs.existsSync(VACATION_FILE)) {
        console.log('휴가 설정을 찾을 수 없습니다. "vacation init"을 먼저 실행해주세요.');
        return;
    }

    const data = JSON.parse(fs.readFileSync(VACATION_FILE, 'utf8'));
    const { join_date, day_hours, used_vacations } = data;

    // --- 날짜 계산 로직 ---
    // 오늘 날짜
    const today = new Date();
    // JSON 파일에서 가져온 입사일
    const joinDate = new Date(join_date);

    /**
     * 두 날짜 사이의 전체 월 수를 계산
     */
    let passedMonths = (today.getFullYear() - joinDate.getFullYear()) * 12;
    passedMonths -= joinDate.getMonth();
    passedMonths += today.getMonth();
    if (today.getDate() < joinDate.getDate()) {
        passedMonths--;
    }
    passedMonths = Math.max(0, passedMonths);


    // 월차는 1년차에만 생성(최대 11일).
    // 12개월차의 휴가는 1주년이 되는 날에 발생하는 연차에 포함
    const firstAnniversary = new Date(joinDate);
    firstAnniversary.setFullYear(firstAnniversary.getFullYear() + 1);

    let generatedMonthlyDays = 0;
    if (today < firstAnniversary) {
        // 1주년 이전인 경우, 생성된 월차를 계산
        generatedMonthlyDays = passedMonths;
    } else {
        // 1주년 이후인 경우, 월차 11일이 모두 부여
        generatedMonthlyDays = 11;
    }
    // 월차는 최대 11일까지 생성
    generatedMonthlyDays = Math.min(11, generatedMonthlyDays);


    const generatedHours = generatedMonthlyDays * day_hours;
    const usedHours = used_vacations.reduce((sum, vac) => sum + vac.hours, 0);
    const remainingHours = generatedHours - usedHours;

    const remainingDays = Math.floor(remainingHours / day_hours);
    const remainingHoursPart = remainingHours % day_hours;

    console.log('[휴가 현황]');
    console.log('');
    console.log(`입사일: ${join_date}`);
    console.log(`생성된 월차: ${generatedMonthlyDays}일 (${generatedHours}시간)`);
    console.log(`사용한 휴가: ${usedHours}시간`);
    console.log(`남은 휴가: ${remainingDays}일 ${remainingHoursPart}시간 (${remainingHours}시간)`);
};

const commands = {
    init,
    add,
    status,
    help: () => {
        console.log(`
사용법: vacation <명령어>

명령어:
  init    입사일을 입력하여 휴가 설정을 초기화합니다.
  add     사용한 휴가를 기록합니다.
  status  현재 휴가 현황을 확인합니다.
  help    도움말을 표시합니다.
        `);
    }
};

const main = () => {
    const command = getCommand();

    if (commands[command]) {
        commands[command]();
    } else {
        commands.help();
    }
};

main();