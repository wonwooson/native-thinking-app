export type AppState = 'input' | 'analyzing' | 'learning' | 'review_list' | 'document_list' | 'document_reader';

export interface DocumentItem {
    id: string;
    title: string;
    fullText: string;
    date: string;
    guideText?: string;
}

export interface HistoryItem {
    id: string;
    title: string;
    date: string;
    data: AnalysisData;
}

export interface InputHistoryItem {
    id: string;
    text: string;
    isLink: boolean;
    date: string;
    batchCount: number;
    parsedSentences?: string[];
    fullText?: string;
    guideText?: string;
}

export interface AnalysisData {
    word_order: {
        original: string;
        blocks: { text: string; role: string }[];
        thinking_flow_ko: string;
        kr_typical_mistake: string;
        quiz: {
            question: string;
            options: string[];
            answer: string;
            feedbackKo: string;
        };
    }[];
    phrasal_verbs: any[];
    tricky_prepositions: any[];
    hasMore?: boolean;
    inputContext?: { text: string; isLink: boolean; batchCount: number; parsedSentences?: string[]; fullText?: string };
}
