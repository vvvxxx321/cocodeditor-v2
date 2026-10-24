import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import java.util.Optional;
import java.util.HashMap;
import java.util.Map;

/**
 * Sample Java program demonstrating various Java features
 */
class Hello {
    // Instance variables
    private String greeting;
    
    // Static variables
    private static final int MAX_AGE = 120;
    
    // Constructor
    public Hello(String greeting) {
        this.greeting = greeting;
    }
    
    // Instance method
    public String sayHello(String name) {
        return greeting + ", " + name + "!";
    }
    
    // Static method
    public static boolean isValidAge(int age) {
        return age >= 0 && age <= MAX_AGE;
    }
    
    // Generic method
    public <T> List<T> filter(List<T> list, Predicate<T> predicate) {
        List<T> result = new ArrayList<>();
        for (T item : list) {
            if (predicate.test(item)) {
                result.add(item);
            }
        }
        return result;
    }
    
    // Inner interface
    interface Predicate<T> {
        boolean test(T t);
    }
    
    // Inner class
    class Person {
        private String name;
        private int age;
        
        public Person(String name, int age) {
            this.name = name;
            if (!isValidAge(age)) {
                throw new IllegalArgumentException("Invalid age: " + age);
            }
            this.age = age;
        }
        
        public String getName() {
            return name;
        }
        
        public int getAge() {
            return age;
        }
        
        @Override
        public String toString() {
            return "Person{name='" + name + "', age=" + age + "}";
        }
    }
    
    // Main method
    public static void main(String[] args) {
        // Create an instance
        Hello hello = new Hello("Hello");
        
        // Call instance method
        System.out.println(hello.sayHello("World"));
        
        // Create a list of persons
        List<Person> persons = new ArrayList<>();
        persons.add(hello.new Person("Alice", 30));
        persons.add(hello.new Person("Bob", 25));
        persons.add(hello.new Person("Charlie", 35));
        
        // Use lambda expressions with our filter method
        List<Person> adults = hello.filter(persons, person -> person.getAge() >= 30);
        System.out.println("Adults: " + adults);
        
        // Use Java 8 streams
        List<String> names = persons.stream()
                .map(Person::getName)
                .collect(Collectors.toList());
        System.out.println("Names: " + names);
        
        // Use Optional
        Optional<Person> youngest = persons.stream()
                .min((p1, p2) -> Integer.compare(p1.getAge(), p2.getAge()));
        youngest.ifPresent(p -> System.out.println("Youngest person: " + p));
        
        // Use Map
        Map<String, Integer> nameToAge = new HashMap<>();
        persons.forEach(p -> nameToAge.put(p.getName(), p.getAge()));
        System.out.println("Name to age map: " + nameToAge);
    }
} 