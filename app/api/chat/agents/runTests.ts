// import { NextRequest, NextResponse } from "next/server";
// import { runTests } from "./route"; // Імпорт функції runTests з попереднього коду

// export async function POST(req: NextRequest) {
//   try {
//     console.log("Starting test runs...");

//     // Запуск функції тестування
//     await runTests();

//     // Повернення відповіді про успішність
//     return NextResponse.json({ message: "Tests completed successfully!" });
//   } catch (e: any) {
//     // У випадку помилки, повертаємо відповідь з помилкою
//     console.error("Error running tests:", e.message);
//     return NextResponse.json({ error: e.message }, { status: 500 });
//   }
// }
