// TypeScript specific interface
interface Person {
    name: string;
    age: number;
    email?: string;
}

// Generic function
function createPair<T, U>(first: T, second: U): [T, U] {
    return [first, second];
}

// Arrow function with type annotations
const greet = (person: Person): string => {
    return `Hello, ${person.name}! You are ${person.age} years old.`;
};

// Class implementation with interface
class Employee implements Person {
    constructor(
        public name: string,
        public age: number,
        private department: string,
        public email?: string
    ) {}

    public getDetails(): string {
        return `${this.name} works in ${this.department}`;
    }
}

// Entry point
function main(): void {
    // Using the generic function
    const pair = createPair<string, number>("TypeScript", 4.9);
    console.log(`Language: ${pair[0]}, Version: ${pair[1]}`);
    
    // Creating an object based on interface
    const alice: Person = {
        name: "Alice",
        age: 30,
        email: "alice@example.com"
    };
    
    console.log(greet(alice));
    
    // Using the class
    const bob = new Employee("Bob", 35, "Engineering");
    console.log(greet(bob));
    console.log(bob.getDetails());
    
    // Array methods with type annotations
    const numbers: number[] = [1, 2, 3, 4, 5];
    const doubled: number[] = numbers.map((n: number): number => n * 2);
    console.log(`Doubled numbers: ${doubled.join(", ")}`);
}

// Call the main function
main(); 