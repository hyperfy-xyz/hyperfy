// title, description and image url for directories and hosts that list worlds, null when unset
export default function (world, { fastify }) {
  fastify.get('/api/world', async () => {
    return {
      title: world.settings.title || null,
      desc: world.settings.desc || null,
      image: world.resolveURL(world.settings.image?.url) || null,
    }
  })
}
