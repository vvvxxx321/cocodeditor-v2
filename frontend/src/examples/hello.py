def greet(name):
    """
    A simple greeting function
    """
    return f"Hello, {name}!"

# Main program
if __name__ == "__main__":
    name = input("Enter your name: ")
    message = greet(name)
    print(message)
    
    # Let's try some Python-specific syntax
    names = ["Alice", "Bob", "Charlie"]
    for i, name in enumerate(names):
        print(f"{i+1}. {name}: {greet(name)}")
    
    # Dictionary comprehension
    name_lengths = {name: len(name) for name in names}
    print(f"Name lengths: {name_lengths}")
    
    # Class definition
    class Person:
        def __init__(self, name, age):
            self.name = name
            self.age = age
        
        def birthday(self):
            self.age += 1
            return f"{self.name} is now {self.age} years old!"
    
    # Use the class
    p = Person("David", 25)
    print(p.birthday()) 