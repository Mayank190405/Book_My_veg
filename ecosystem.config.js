module.exports = {
    apps: [
        {
            name: "bmv-client",
            script: "npm",
            args: "start",
            cwd: "./client",
            env: {
                PORT: 3000,
                NODE_ENV: "production",
            },
        },
        {
            name: "bmv-server",
            script: "dist/index.js",
            cwd: "./server",
            env: {
                PORT: 5000,
                NODE_ENV: "production",
            },
        },
    ],
};
