console.log('Crash Block app loaded!')

app.on('update', delta => {
  app.rotation.y += delta * 10
})