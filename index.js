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
        console.log('❗ Vacation settings already exist.');
        return;
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('Please enter your join date (YYYY-MM-DD): ', (joinDate) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(joinDate)) {
            console.log('❌ Invalid date format. Please use YYYY-MM-DD.');
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
        console.log(`✅ Vacation settings initialized. Data saved to ${VACATION_FILE}`);
        rl.close();
    });
};

const status = () => {
    if (!fs.existsSync(VACATION_FILE)) {
        console.log('❗ No vacation settings found. Please run "vacation init" first.');
        return;
    }

    const data = JSON.parse(fs.readFileSync(VACATION_FILE, 'utf8'));
    const { join_date, day_hours, used_vacations } = data;

    // --- Date Calculation Logic ---
    // Today's date
    const today = new Date();
    // Join date from the JSON file
    const joinDate = new Date(join_date);

    /**
     * Calculates the number of full months passed between two dates.
     * This is the core logic for determining monthly leave generation.
     *
     * Example:
     * joinDate: 2025-05-20
     * today: 2025-07-25
     *
     * 1. Month difference: 7 - 5 = 2 months.
     * 2. Day check: 25 >= 20, so the second month is considered "full".
     * Result: 2 months have passed.
     *
     * Example 2:
     * joinDate: 2025-05-20
     * today: 2025-07-19
     *
     * 1. Month difference: 7 - 5 = 2 months.
     * 2. Day check: 19 < 20, so the second month is not yet "full".
     * Result: 1 month has passed.
     */
    let passedMonths = (today.getFullYear() - joinDate.getFullYear()) * 12;
    passedMonths -= joinDate.getMonth();
    passedMonths += today.getMonth();
    if (today.getDate() < joinDate.getDate()) {
        passedMonths--;
    }
    passedMonths = Math.max(0, passedMonths);


    // Monthly leave is generated only for the first year (up to 11 days).
    // The 12th month's leave is part of the annual leave given on the first anniversary.
    const firstAnniversary = new Date(joinDate);
    firstAnniversary.setFullYear(firstAnniversary.getFullYear() + 1);

    let generatedMonthlyDays = 0;
    if (today < firstAnniversary) {
        // If it's before the first anniversary, calculate generated monthly leave.
        generatedMonthlyDays = passedMonths;
    } else {
        // After the first anniversary, the full 11 days of monthly leave are granted.
        generatedMonthlyDays = 11;
    }
    // The maximum number of monthly leaves is 11.
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

const add = () => {
    if (!fs.existsSync(VACATION_FILE)) {
        console.log('❗ No vacation settings found. Please run "vacation init" first.');
        return;
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('Enter vacation date (YYYY-MM-DD): ', (date) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            console.log('❌ Invalid date format. Please use YYYY-MM-DD.');
            rl.close();
            return;
        }

        rl.question('Enter hours used: ', (hoursStr) => {
            const hours = parseInt(hoursStr, 10);
            if (isNaN(hours) || hours <= 0) {
                console.log('❌ Invalid hours. Please enter a positive number.');
                rl.close();
                return;
            }

            const data = JSON.parse(fs.readFileSync(VACATION_FILE, 'utf8'));
            const { join_date, day_hours, used_vacations } = data;

            // --- Calculate available hours (same logic as status) ---
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
                console.log(`❗ Cannot use ${hours} hours. Only ${remainingHours} hours remaining.`);
                rl.close();
                return;
            }

            data.used_vacations.push({ date, hours });
            fs.writeFileSync(VACATION_FILE, JSON.stringify(data, null, 2));
            console.log('✅ Vacation usage recorded.');
            rl.close();
        });
    });
};

const commands = {
    init,
    add,
    status,
    help: () => {
        console.log(`
Usage: vacation <command>
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
