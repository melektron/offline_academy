/*
ELEKTRON © 2023 - now
Written by melektron
www.elektron.work
04.10.23, 12:19

Sleep function
*/

// https://stackoverflow.com/questions/1183872/put-a-delay-in-javascript
export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
