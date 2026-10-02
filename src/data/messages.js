const messages = [
    {
        id: 1,
        role: "user",
        content: "Explain how neural networks learn."
    },
    {
        id: 2,
        role: "assistant",
        content:
            "Neural networks learn by adjusting their weights based on the error in their predictions. This process uses backpropagation and gradient descent to gradually improve the model."
    },
    {
        id: 3,
        role: "user",
        content: "What exactly is gradient descent?"
    },
    {
        id: 4,
        role: "assistant",
        content:
            "Gradient descent is an optimization algorithm used to minimize the error of a model. It repeatedly adjusts the model's parameters in the direction that reduces the error."
    }
];

export default messages;