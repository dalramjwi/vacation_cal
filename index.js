#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const VACATION_DIR = path.join(os.homedir(), '.vacation');
const VACATION_FILE = path.join(VACATION_DIR, 'vacation.json');

const getCommand = () => {
    const args = process.argv.slice(2);
    return args[0];
};

const init = () => {
    if (fs.existsSync(VACATION_FILE)) {
        console.log('❗ 이미 휴가 설정이 존재합니다.');
        return;
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('입사일을 입력해주세요 (YYYY-MM-DD): ', (joinDate) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(joinDate)) {
            console.log('❌ 날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식으로 입력해주세요.');
            rl.close();
            return;
        }

        if (!fs.existsSync(VACATION_DIR)) {
            fs.mkdirSync(VACATION_DIR, { recursive: true });
        }

        const data = {
            join_date: joinDate,
            day_hours: 8,
            used_vacations: []
        };

        fs.writeFileSync(VACATION_FILE, JSON.stringify(data, null, 2));
        console.log(`✅ 휴가 설정이 완료되었습니다. 설정 파일: ${VACATION_FILE}`);
        rl.close();
    });
};

const add = () => {
    if (!fs.existsSync(VACATION_FILE)) {
        console.log('❗ 휴가 설정을 찾을 수 없습니다. "vacation init"을 먼저 실행해주세요.');
        return;
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('사용한 날짜를 입력해주세요 (YYYY-MM-DD): ', (date) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            console.log('❌ 날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식으로 입력해주세요.');
            rl.close();
            return;
        }

        rl.question('사용한 시간을 입력해주세요: ', (hoursStr) => {
            const hours = parseInt(hoursStr, 10);
            if (isNaN(hours) || hours <= 0) {
                console.log('❌ 시간이 올바르지 않습니다. 양수의 숫자를 입력해주세요.');
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
            console.log('✅ 휴가 사용이 기록되었습니다.');
            rl.close();
        });
    });
};

const status = () => {
    if (!fs.existsSync(VACATION_FILE)) {
        console.log('❗ 휴가 설정을 찾을 수 없습니다. "vacation init"을 먼저 실행해주세요.');
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
     * 두 날짜 사이의 전체 월 수를 계산합니다.
     * 월차 생성을 위한 핵심 로직입니다.
     *
     * 예시 1:
     * 입사일: 2025-05-20
     * 오늘: 2025-07-25
     *
     * 1. 월 차이: 7 - 5 = 2개월
     * 2. 일자 확인: 25 >= 20 이므로, 두 번째 달은 "꽉 찬" 달로 간주합니다.
     * 결과: 2개월이 지났습니다.
     *
     * 예시 2:
     * 입사일: 2025-05-20
     * 오늘: 2025-07-19
     *
     * 1. 월 차이: 7 - 5 = 2개월
     * 2. 일자 확인: 19 < 20 이므로, 두 번째 달은 아직 "꽉 차지" 않았습니다.
     * 결과: 1개월이 지났습니다.
     */
    let passedMonths = (today.getFullYear() - joinDate.getFullYear()) * 12;
    passedMonths -= joinDate.getMonth();
    passedMonths += today.getMonth();
    if (today.getDate() < joinDate.getDate()) {
        passedMonths--;
    }
    passedMonths = Math.max(0, passedMonths);


    // 월차는 1년차에만 생성됩니다 (최대 11일).
    // 12개월차의 휴가는 1주년이 되는 날에 발생하는 연차에 포함됩니다.
    const firstAnniversary = new Date(joinDate);
    firstAnniversary.setFullYear(firstAnniversary.getFullYear() + 1);

    let generatedMonthlyDays = 0;
    if (today < firstAnniversary) {
        // 1주년 이전인 경우, 생성된 월차를 계산합니다.
        generatedMonthlyDays = passedMonths;
    } else {
        // 1주년 이후인 경우, 월차 11일이 모두 부여됩니다.
        generatedMonthlyDays = 11;
    }
    // 월차는 최대 11일까지 생성됩니다.
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