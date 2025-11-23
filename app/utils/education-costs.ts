export type EducationCourse = 'public' | 'private_uni' | 'private_hs' | 'private_jhs';

export const EDUCATION_COURSE_LABELS: Record<EducationCourse, string> = {
    public: 'すべて公立（約1,000万円）',
    private_uni: '大学のみ私立（約1,200万円）',
    private_hs: '高校から私立（約1,400万円）',
    private_jhs: '中学から私立（約1,800万円）',
};

// 月額換算の目安（単位：円）
// 文部科学省「子供の学習費調査」などを参考にした概算
// 塾代は別途計算するため、ここでは学校教育費＋給食費＋学校外活動費（塾以外）とする
export const EDUCATION_MONTHLY_COSTS = {
    kindergarten: {
        public: 15_000,
        private: 30_000,
    },
    elementary: {
        public: 15_000, // 塾なし
        private: 80_000, // 塾なし
    },
    juniorHigh: {
        public: 25_000, // 塾なし
        private: 90_000, // 塾なし
    },
    highSchool: {
        public: 30_000, // 塾なし
        private: 60_000, // 塾なし
    },
    university: {
        public: 80_000, // 国公立
        private: 120_000, // 私立文系平均
    },
};

// 塾代の月額目安（通う場合）
export const CRAM_SCHOOL_MONTHLY_COSTS = {
    elementary: {
        public: 15_000, // 公立小（補習・受験なし）
        private: 30_000, // 私立小・中学受験
    },
    juniorHigh: {
        public: 30_000, // 公立中（高校受験）
        private: 25_000, // 私立中（補習）
    },
    highSchool: {
        public: 35_000, // 公立高（大学受験）
        private: 40_000, // 私立高（大学受験）
    },
    university: 0, // 大学では通常塾代は考慮しない
};

export type CramSchoolOptions = {
    elementary: boolean;
    juniorHigh: boolean;
    highSchool: boolean;
};

export const getEducationCostPerMonth = (
    course: EducationCourse,
    age: number,
    cramSchoolOptions: CramSchoolOptions
): number => {
    let baseCost = 0;
    let cramSchoolCost = 0;

    // 0-2歳: 保育園等（個人差大きいため一旦0）
    if (age < 3) return 0;

    // 3-5歳: 幼稚園
    if (age <= 5) {
        baseCost = course === 'public'
            ? EDUCATION_MONTHLY_COSTS.kindergarten.public
            : EDUCATION_MONTHLY_COSTS.kindergarten.private;
    }
    // 6-11歳: 小学校
    else if (age <= 11) {
        baseCost = EDUCATION_MONTHLY_COSTS.elementary.public;
        if (cramSchoolOptions.elementary) {
            cramSchoolCost = course === 'private_jhs'
                ? CRAM_SCHOOL_MONTHLY_COSTS.elementary.private
                : CRAM_SCHOOL_MONTHLY_COSTS.elementary.public;
        }
    }
    // 12-14歳: 中学校
    else if (age <= 14) {
        if (course === 'private_jhs') {
            baseCost = EDUCATION_MONTHLY_COSTS.juniorHigh.private;
            if (cramSchoolOptions.juniorHigh) cramSchoolCost = CRAM_SCHOOL_MONTHLY_COSTS.juniorHigh.private;
        } else {
            baseCost = EDUCATION_MONTHLY_COSTS.juniorHigh.public;
            if (cramSchoolOptions.juniorHigh) cramSchoolCost = CRAM_SCHOOL_MONTHLY_COSTS.juniorHigh.public;
        }
    }
    // 15-17歳: 高校
    else if (age <= 17) {
        if (course === 'private_jhs' || course === 'private_hs') {
            baseCost = EDUCATION_MONTHLY_COSTS.highSchool.private;
            if (cramSchoolOptions.highSchool) cramSchoolCost = CRAM_SCHOOL_MONTHLY_COSTS.highSchool.private;
        } else {
            baseCost = EDUCATION_MONTHLY_COSTS.highSchool.public;
            if (cramSchoolOptions.highSchool) cramSchoolCost = CRAM_SCHOOL_MONTHLY_COSTS.highSchool.public;
        }
    }
    // 18-21歳: 大学
    else if (age <= 21) {
        if (course === 'public') {
            baseCost = EDUCATION_MONTHLY_COSTS.university.public;
        } else {
            baseCost = EDUCATION_MONTHLY_COSTS.university.private;
        }
    }

    return baseCost + cramSchoolCost;
};

export const calculateHouseholdEducationCost = (
    course: EducationCourse,
    childrenAges: number[],
    cramSchoolOptions: CramSchoolOptions
): number => {
    return childrenAges.reduce((total, age) => {
        return total + getEducationCostPerMonth(course, age, cramSchoolOptions);
    }, 0);
};
